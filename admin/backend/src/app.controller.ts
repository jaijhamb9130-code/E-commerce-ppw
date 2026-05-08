import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Put,
  Query,
  Request,
  HttpException,
  UnauthorizedException,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AuthService } from './auth/auth.service';
import { TallyService } from './tally.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Ledger } from './entities/ledger.entity';
import { Repository, In } from 'typeorm';
import { StockItem } from './entities/stock-item.entity';
import { Order } from './entities/order.entity';
import { OrderDetail } from './entities/order-detail.entity';
import { Meta } from './entities/meta.entity';
import { Customer } from './entities/customer.entity';
import { Address } from './entities/address.entity';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from './auth/permissions.guard';
import { RequirePermission } from './auth/permissions.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly authService: AuthService,
    private readonly tallyService: TallyService,
    @InjectRepository(Ledger)
    private ledgerRepo: Repository<Ledger>,
    @InjectRepository(StockItem)
    private stockRepo: Repository<StockItem>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(OrderDetail)
    private orderDetailRepo: Repository<OrderDetail>,
    @InjectRepository(Meta)
    private metaRepo: Repository<Meta>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectRepository(Address)
    private addressRepo: Repository<Address>,
  ) {}

  // In-memory rate limit for unauthenticated /orders/online endpoint.
  // Survives only within a single Node process — sufficient to deter
  // casual spam without adding a Redis dep. Resets on every restart.
  private static readonly ONLINE_ORDER_RATE_WINDOW_MS = 60 * 60 * 1000; // 1h
  private static readonly ONLINE_ORDER_RATE_MAX = 10; // per phone per window
  private static readonly onlineOrderRateMap = new Map<
    string,
    { count: number; windowStart: number }
  >();

  // Strip non-digits, take last 10. Treats '+91 9999999999', '09999999999',
  // '999-999-9999' and '9999999999' as the same identity. Returns null when
  // the input has fewer than 10 digits.
  static normalizePhone(input: any): string | null {
    if (input == null) return null;
    const digits = String(input).replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.slice(-10);
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('dashboard')
  @Get('dashboard/stats')
  async getDashboardStats() {
    const today = new Date();
    // Convert to IST offset (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(today.getTime() + istOffset);
    const todayStr = `${istTime.getUTCFullYear()}-${String(istTime.getUTCMonth() + 1).padStart(2, '0')}-${String(istTime.getUTCDate()).padStart(2, '0')}`;

    // Current financial year: April 1 to March 31
    const fyStart = today.getMonth() >= 3
      ? `${today.getFullYear()}-04-01`
      : `${today.getFullYear() - 1}-04-01`;

    // Today's orders count and total sales (Offline)
    const todayStats = await this.orderRepo
      .createQueryBuilder('order')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(order.total_amount), 0)', 'total')
      .where('order.date = :todayStr', { todayStr })
      .andWhere("order.order_type = 'Tax Invoice'")
      .getRawOne();

    // Online Stats
    let onlineTotal = 0, onlinePending = 0, onlineCompleted = 0, onlineUnique = 0;
    try {
        onlineTotal = await this.orderRepo.count({ where: { source: 'online', date: todayStr as any } });
        onlinePending = await this.orderRepo.count({ where: { source: 'online', status: 'pending' as any, date: todayStr as any } });
        const completedCount = await this.orderRepo.count({ where: { source: 'online', status: 'completed' as any, date: todayStr as any } });
        const fetchedCount = await this.orderRepo.count({ where: { source: 'online', status: 'fetched' as any, date: todayStr as any } });
        onlineCompleted = completedCount + fetchedCount;
        
        const uniqueData = await this.orderRepo.createQueryBuilder('order')
            .select('COUNT(DISTINCT order.phone_number)', 'count')
            .where('order.source = :source', { source: 'online' })
            .andWhere('order.date = :todayStr', { todayStr })
            .getRawOne();
        onlineUnique = parseInt(uniqueData?.count) || 0;
    } catch (e) {
        console.error('Error fetching online stats:', e);
    }

    // Staff activity today (Only Online Actions)
    // 1. Check Order Processing (Finalizations)
    const orderActionsDetailed = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoin('order.processor', 'processor')
      .select('processor.id', 'processor_id')
      .addSelect('processor.name', 'processor_name')
      .addSelect('order.id', 'order_number')
      .addSelect('order.status', 'status')
      .where('DATE(order.processed_at) = :todayStr', { todayStr })
      .andWhere("order.source = 'online'")
      .getRawMany();

    // 2. Check Item Processing (Approvals/Rejections)
    const itemActionsDetailed = await this.orderDetailRepo
      .createQueryBuilder('detail')
      .leftJoin('detail.processor', 'processor')
      .leftJoin('detail.order', 'order')
      .select('processor.id', 'processor_id')
      .addSelect('processor.name', 'processor_name')
      .addSelect('order.id', 'order_number')
      .addSelect('detail.status', 'status')
      .where('DATE(detail.processed_at) = :todayStr', { todayStr })
      .getRawMany();

    // Merge actions by staff ID
    const staffMap = new Map<number, any>();
    orderActionsDetailed.forEach(a => {
        if (!a.processor_id) return;
        const existing = staffMap.get(a.processor_id) || { id: a.processor_id, name: a.processor_name, actions: 0, details: [] };
        existing.actions++;
        existing.details.push(`Processed Order ${a.order_number} to ${a.status}`);
        staffMap.set(a.processor_id, existing);
    });
    
    itemActionsDetailed.forEach(a => {
        if (!a.processor_id) return;
        const existing = staffMap.get(a.processor_id) || { id: a.processor_id, name: a.processor_name, actions: 0, details: [] };
        existing.actions++;
        existing.details.push(`Marked item in ${a.order_number || 'Order'} as ${a.status}`);
        staffMap.set(a.processor_id, existing);
    });

    const staffActivity = Array.from(staffMap.values())
        .sort((a, b) => b.actions - a.actions);

    // Total ledgers
    const ledgerCount = await this.ledgerRepo.count();

    // Total active stock items
    const stockCount = await this.stockRepo.count({ where: { is_active: true } });

    // Total orders in current FY
    const fyOrders = await this.orderRepo
      .createQueryBuilder('order')
      .select('COUNT(*)', 'count')
      .where('order.date >= :fyStart', { fyStart })
      .getRawOne();

    // Get last sync timestamps
    const lastSyncLedgers = await this.metaRepo.findOne({ where: { key: 'last_sync_ledgers' } });
    const lastSyncStock = await this.metaRepo.findOne({ where: { key: 'last_sync_stock' } });

    return {
      today: {
        orders: parseInt(todayStats.count) || 0,
        sales: parseFloat(todayStats.total) || 0,
      },
      online: {
        total: onlineTotal,
        pending: onlinePending,
        completed: onlineCompleted,
        unique: onlineUnique
      },
      staffActivity,
      ledgerCount,
      stockCount,
      fyOrders: parseInt(fyOrders.count) || 0,
      lastSync: {
        ledgers: lastSyncLedgers?.value || null,
        stock: lastSyncStock?.value || null,
      },
    };
  }

  @Post('auth/login')
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(
      body.username,
      body.password,
    );
    if (!user) {
      throw new UnauthorizedException({
        error: 'invalid_credentials',
        message: 'Invalid username or password',
      });
    }
    // Return JWT token
    return this.authService.login(user);
  }

  @Post('auth/register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('inventory')
  @Post('ledgers')
  async createLedger(@Body() body: any) {
    if (!body.name) throw new Error('Name is required');

    // Advanced Duplicate Check: (Name + Phone) OR (GSTIN)
    let existingLedger: Ledger | null = null;

    if (body.gstin) {
      existingLedger = await this.ledgerRepo.findOne({
        where: { gstin: body.gstin },
      });
    }

    if (!existingLedger && body.name && body.phone_number) {
      existingLedger = await this.ledgerRepo.findOne({
        where: {
          name: body.name,
          phone_number: body.phone_number,
        },
      });
    }

    // Fallback: Check just name if no other unique identifier provided (optional, but requested by user)
    // "name and mobile will be the one by which we can differentiate" -> implies specific combo?
    // User said: "if not in tally and serve".
    // Let's stick to strict: Name+Mobile OR GSTIN.
    // If only Name is provided and duplicates exist, system might create duplicate?
    // User previous request: "check duplicate name". Let's keep name check as last resort backup to prevent simple spam.
    if (!existingLedger) {
      existingLedger = await this.ledgerRepo.findOne({
        where: { name: body.name },
      });
    }

    if (existingLedger) {
      return existingLedger;
    }

    const ledger = new Ledger();
    ledger.name = body.name;
    ledger.address = body.address;
    ledger.person_name = body.person_name;
    ledger.phone_number = body.phone_number;
    ledger.email = body.email;
    ledger.gstin = body.gstin;
    ledger.pincode = body.pincode;
    ledger.state = body.state;
    return this.ledgerRepo.save(ledger);
  }

  @Post('orders/online')
  // Public endpoint (no JWT) — customer app calls this directly.
  // Hardened: input validation, per-phone rate limit, server-side price lookup
  // (no client-trusted prices), Customer find-or-create linkage, optional Address linkage.
  async createOnlineOrder(@Body() body: any) {
    try {
      // 1. Validate body shape (Fix #4, #5: fail fast with HTTP 400 instead of NaN/500)
      const { name, phone, address, pincode, city, state, items, remark, ledger_id, address_id } =
        body || {};

      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new HttpException('name is required', 400);
      }
      // Accept any phone format — '+91 9999999999', '09999999999', '999-999-9999' etc.
      // Stored canonically as 10 digits so identity matches across history.
      const phoneStr = AppController.normalizePhone(phone);
      if (!phoneStr) {
        throw new HttpException('phone must contain at least 10 digits', 400);
      }
      if (!address || typeof address !== 'string' || !address.trim()) {
        throw new HttpException('address is required', 400);
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new HttpException('items must be a non-empty array', 400);
      }

      // 2. Per-phone rate limit (Fix #3: deters spam without adding deps).
      // In-memory only; resets on process restart. For stronger guarantees move to Redis.
      const now = Date.now();
      const bucket = AppController.onlineOrderRateMap.get(phoneStr);
      if (bucket && now - bucket.windowStart < AppController.ONLINE_ORDER_RATE_WINDOW_MS) {
        if (bucket.count >= AppController.ONLINE_ORDER_RATE_MAX) {
          throw new HttpException(
            'Order limit reached for this phone — try again later',
            429,
          );
        }
        bucket.count += 1;
      } else {
        AppController.onlineOrderRateMap.set(phoneStr, { count: 1, windowStart: now });
      }

      // 3. Validate items + bulk-load StockItems (Fix #2: server-side price lookup)
      type ItemReq = { masterid: string; quantity: number; unit?: string };
      const itemReqs: ItemReq[] = [];
      for (const it of items) {
        if (!it || typeof it.masterid !== 'string' || !it.masterid.trim()) {
          throw new HttpException('each item must have a masterid', 400);
        }
        const qty = Number(it.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new HttpException(`invalid quantity for ${it.masterid}`, 400);
        }
        itemReqs.push({
          masterid: it.masterid.trim(),
          quantity: qty,
          unit: typeof it.unit === 'string' ? it.unit : undefined,
        });
      }

      const masterids = Array.from(new Set(itemReqs.map((i) => i.masterid)));
      const stocks = await this.stockRepo.find({ where: { masterid: In(masterids) } });
      const stockByMasterid = new Map(stocks.map((s) => [s.masterid, s]));

      type ResolvedDetail = {
        masterid: string;
        item_name: string;
        quantity: number;
        rate: number;
        amount: number;
        unit: string;
      };
      const resolved: ResolvedDetail[] = [];
      let computedTotal = 0;
      for (const req of itemReqs) {
        const sk = stockByMasterid.get(req.masterid);
        if (!sk) {
          throw new HttpException(`stock item not found: ${req.masterid}`, 400);
        }
        if (sk.is_active === false) {
          throw new HttpException(`item is inactive: ${req.masterid}`, 410);
        }
        // Mirror customer/api.ts transformStockItemToProduct: parse leading number
        // from default_mrp ("50.00/Pcs" -> 50). This keeps server-side price ≡ what
        // the customer sees on the product page.
        const mrpMatch = sk.default_mrp ? sk.default_mrp.match(/^([-+]?[0-9]*\.?[0-9]+)/) : null;
        const rate = mrpMatch ? parseFloat(mrpMatch[1]) : NaN;
        if (!Number.isFinite(rate) || rate <= 0) {
          throw new HttpException(`no valid price for ${req.masterid}`, 400);
        }
        const amount = +(rate * req.quantity).toFixed(2);
        computedTotal += amount;
        resolved.push({
          masterid: req.masterid,
          item_name: sk.name,
          quantity: req.quantity,
          rate,
          amount,
          unit: req.unit || sk.base_units || 'Pcs',
        });
      }
      computedTotal = +computedTotal.toFixed(2);

      // 4. Find-or-create Customer (Fix #1: link order via customer_id)
      let customer = await this.customerRepo.findOne({ where: { phone_number: phoneStr } });
      if (!customer) {
        customer = new Customer();
        customer.phone_number = phoneStr;
        customer.name = name.trim();
        customer = await this.customerRepo.save(customer);
      }

      // 5. Validate optional address_id belongs to this customer (Fix #1)
      let resolvedAddressId: number | undefined;
      if (address_id != null) {
        const aid = Number(address_id);
        if (!Number.isInteger(aid) || aid <= 0) {
          throw new HttpException('address_id must be a positive integer', 400);
        }
        const addr = await this.addressRepo.findOne({
          where: { id: aid, customer_id: customer.id },
        });
        if (!addr) {
          throw new HttpException('address_id does not belong to this customer', 400);
        }
        resolvedAddressId = addr.id;
      }

      // 6. Build order — total_amount is server-computed (NEVER from body.total)
      const order = new Order();
      order.customer_id = customer.id;
      if (resolvedAddressId !== undefined) order.address_id = resolvedAddressId;
      order.customer_name = name.trim();
      order.customer_phone = phoneStr;
      order.customer_address = address;
      order.customer_pincode = pincode;
      order.customer_city = city || '';
      order.customer_state = state;
      order.date = new Date();
      order.total_amount = computedTotal;
      order.order_type = 'Online Order';
      order.status = 'pending';
      order.source = 'online';
      order.remark =
        typeof remark === 'string' && remark.trim() ? remark.trim() : 'Placed via Customer Portal';
      if (ledger_id != null) {
        const lid = Number(ledger_id);
        if (Number.isInteger(lid) && lid > 0) {
          order.ledger = { id: lid } as Ledger;
        }
      }

      const savedOrder = await this.orderRepo.save(order);

      // 7. Save details with server-resolved values
      for (const r of resolved) {
        const detail = new OrderDetail();
        detail.order = savedOrder;
        detail.item_name = r.item_name;
        detail.quantity = r.quantity;
        detail.rate = r.rate;
        detail.amount = r.amount;
        detail.stock_item_id = r.masterid;
        detail.unit = r.unit;
        detail.status = 'pending';
        await this.orderDetailRepo.save(detail);
      }

      return savedOrder;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('CRITICAL ERROR IN createOnlineOrder:', error);
      throw new HttpException('Failed to create order', 500);
    }
  }


  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orders')
  @Patch('orders/:id/finalize')
  async finalizeOrder(@Param('id') id: string, @Request() req: any) {
    const orderId = parseInt(id);
    const order = await this.orderRepo.findOne({
      where: { id: orderId }
    });
    if (!order) throw new Error('Order not found');

    const remainingPending = await this.orderDetailRepo.count({
      where: { order: { id: orderId }, status: 'pending' }
    });

    if (remainingPending > 0) {
        throw new HttpException('Cannot finalize order with pending items.', 400);
    }

    await this.orderRepo.update(orderId, { 
        status: 'completed',
        processed_by: req.user.id,
        processed_at: new Date()
    });
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orders')
  @Patch('orders/items/bulk-status')
  async updateBulkStatus(@Body() body: { itemIds: number[], status: 'approved' | 'rejected' }, @Request() req: any) {
    const { itemIds, status } = body;
    if (!itemIds || itemIds.length === 0) return { success: true };
    
    // Update multiple items at once
    await this.orderDetailRepo.update(itemIds, { 
        status,
        processed_by: req.user.id,
        processed_at: new Date()
    });
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orders')
  @Patch('orders/items/:id')
  async updateOrderItem(@Param('id') id: number, @Body() body: any, @Request() req: any) {
    const item = await this.orderDetailRepo.findOne({
      where: { id },
      relations: ['order']
    });

    if (!item) throw new Error('Item not found');
    
    // STRICT RULE: Block if order is completed or fetched
    if (item.order.status === 'completed' || item.order.status === 'fetched') {
      throw new Error('Cannot edit items in a completed or synced order.');
    }

    const { quantity, rate, discount_percentage } = body;
    item.quantity = quantity ?? item.quantity;
    item.rate = rate ?? item.rate;
    item.discount_percentage = discount_percentage ?? item.discount_percentage;
    item.amount = (item.quantity * item.rate) * (1 - (item.discount_percentage / 100));
    
    // Auditor fields
    item.processed_by = req.user.id;
    item.processed_at = new Date();
    
    await this.orderDetailRepo.save(item);

    // Update order total
    const allItems = await this.orderDetailRepo.find({ where: { order: { id: item.order.id } } });
    const newTotal = allItems.reduce((sum, i) => sum + Number(i.amount), 0);
    await this.orderRepo.save({ ...item.order, total_amount: newTotal });

    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orders')
  @Post('orders/online/sync')
  async syncCompletedOrders() {
    // Marks ALL 'completed' online orders as 'fetched' and records sync time
    await this.orderRepo.update(
      { status: 'completed', source: 'online' },
      { 
        status: 'fetched',
        synced_at: new Date()
      }
    );
    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orders')
  @Post('orders')
  async createOrder(@Body() body: any) {
    try {
    const {
      bill_number,
      ledger_id,
      date,
      total_amount,
      items,
      created_by,
      order_type,
      remark,
      amount_given,
    } = body;

    const ledger = await this.ledgerRepo.findOneBy({ id: ledger_id });
    if (!ledger) {
      throw new Error('Ledger not found');
    }

    if (bill_number) {
      const existingOrder = await this.orderRepo.findOne({
        where: { bill_number },
      });
      if (existingOrder) {
        throw new Error(
          `Order with Bill Number '${bill_number}' already exists.`,
        );
      }
    }

    const order = new Order();
    // Allow null bill_number, user might enter it later via Tally or manually
    order.bill_number = bill_number || null;
    order.ledger = ledger;
    order.date = date;
    order.total_amount = total_amount;
    order.order_type = order_type || 'Tax Invoice';
    order.remark = remark;
    order.amount_given = amount_given;

    // Snapshot customer details
    if (ledger) {
      order.customer_name = ledger.person_name || ledger.name;
      order.customer_address = ledger.address;
      order.customer_phone = ledger.phone_number;
      order.customer_email = ledger.email;
      order.customer_gstin = ledger.gstin;
      order.customer_pincode = ledger.pincode;
      order.customer_state = ledger.state;
    }

    // Set created_by if provided
    if (created_by) {
      order.created_by = created_by;
    }
    order.source = 'admin';

    const savedOrder = await this.orderRepo.save(order);
    for (const item of items) {
      const orderDetail = new OrderDetail();
      orderDetail.order = savedOrder;

      // item.name (from frontend selection) is the authoritative name — NEVER overwrite it
      orderDetail.item_name = item.name;
      orderDetail.rate = item.rate;
      orderDetail.unit = item.unit;
      orderDetail.quantity = item.quantity;
      orderDetail.amount = item.amount;
      orderDetail.gst = item.gst;
      orderDetail.selected_scheme = item.selected_scheme;
      orderDetail.discount_percentage = item.selected_discount;
      orderDetail.livestock_type = item.livestock_type;
      orderDetail.stock_item_id = item.masterid ?? null;
      orderDetail.parent = item.parent || null;
      orderDetail.group = item.group || null;
      orderDetail.category = item.category || null;

      await this.orderDetailRepo.save(orderDetail);
    }

    return savedOrder;
   } catch (error) {
     console.error("Order Creation Error:", error);
     throw new Error(`Order Creation failed: ${error.message} \n ${error.stack}`);
   }
  }

  @Get('stock-items/live-stock')
  async getLiveStock(@Query('masterid') masterid: string) {
    const stockItem = await this.stockRepo.findOneBy({ masterid });
    if (!stockItem) return { shop: '0.00', pb: '0.00' };

    // Quick check: if DB already has an expiry date that has passed, delete immediately
    if (stockItem.expiry_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(stockItem.expiry_date);
      expiry.setHours(0, 0, 0, 0);
      if (today >= expiry) {
        await this.stockRepo.delete({ masterid });
        throw new HttpException('Sorry, selected item is inactive. Please select an active item.', 410);
      }
    }

    try {
      console.log(`[LiveStock] Fetching for item: "${stockItem.name}" (MasterID: ${masterid})`);
      const collection = await this.tallyService.fetchItemGodownStock(
        stockItem.name,
      );
      console.log(`[LiveStock] Received ${collection.length} entries from Tally.`);
      if (collection.length === 0) {
        // Log the search payload just in case
        console.log(`[LiveStock] Empty collection for "${stockItem.name}".`);
      }

      let shopQty = 0;
      let pbQty = 0;
      let liveUnit = '';
      let isInactive = false;

      for (const entry of collection) {
        const status = this.tallyService.findCustomField(entry, 'ABSStatus').toLowerCase();
        if (status === 'inactive') {
          isInactive = true;
          break;
        }

        const godownName = this.tallyService.findCustomField(entry, 'GodownName') ||
                           this.tallyService.findCustomField(entry, 'Name');

        const closingBalRaw = this.tallyService.findCustomField(entry, 'StkClBalance') ||
                              this.tallyService.findCustomField(entry, 'ClosingBalance') ||
                              '0';

        // Extract value and unit (e.g., " 9042.00 Pcs" -> 9042.0, "Pcs")
        // Tally sometimes returns a string like " 9042.00 Pcs" or just "9042.00"
        const match = closingBalRaw.trim().match(/^([-+]?[0-9]*\.?[0-9]+)\s*(.*)$/);
        const closingBal = match ? parseFloat(match[1]) : parseFloat(closingBalRaw) || 0;
        if (match && match[2] && !liveUnit) {
          liveUnit = match[2].trim();
        }

        const lowerGodown = godownName.toLowerCase();
        if (lowerGodown.includes('shop')) {
          shopQty += closingBal;
        } else if (
          lowerGodown.includes('pb') ||
          lowerGodown.includes('p.b') ||
          lowerGodown.includes('panbazar')
        ) {
          pbQty += closingBal;
        }
      }

      if (isInactive) {
        await this.stockRepo.delete({ masterid });
        throw new HttpException('Sorry, selected item is inactive. Please select an active item.', 410);
      }

      return {
        shop: shopQty.toFixed(2),
        pb: pbQty.toFixed(2),
        unit: liveUnit || stockItem.base_units || 'Pcs',
      };
    } catch (e) {
      // If it's a known HttpException (e.g. 410 inactive), re-throw it
      if (e instanceof HttpException) throw e;
      // Otherwise Tally is unreachable — return 0 stock gracefully without resetting the popup
      console.warn(`Tally unreachable for live stock of ${stockItem.name}: ${e.message}`);
      return { shop: '0.00', pb: '0.00', unit: stockItem.base_units || 'Pcs' };
    }
  }

  // Separate sync endpoints
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('inventory')
  @Post('sync/ledgers')
  async syncLedgers() {
    return this.tallyService.fetchAndSaveLedgers();
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('inventory')
  @Post('sync/stock-items')
  async syncStockItems() {
    return this.tallyService.fetchAndSaveStockItems();
  }

  @Get('version')
  getVersion() {
    return {
      version: '1.2.2',
      status: 'Running',
      stripped_chars: [
        ' ',
        '-',
        '.',
        '/',
        '(',
        ')',
        '[',
        ']',
        '_',
        '{',
        '}',
        '&',
        '@',
      ],
      timestamp: new Date().toISOString(),
    };
  }

  // Combined sync (legacy)
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('inventory')
  @Post('sync')
  async syncData() {
    try {
      return await this.tallyService.syncAll();
    } catch (error) {
      console.error('Error in syncData:', error);
      throw error;
    }
  }

  // Helper to generate nested REPLACE SQL
  private cleanSql(column: string): string {
    // List of characters to strip: special symbols + whitespace
    // Removed '?' and ':' to avoid TypeORM parameter parsing issues
    const chars = [
      ' ',
      '!',
      '@',
      '#',
      '$',
      '%',
      '^',
      '&',
      '*',
      '(',
      ')',
      '_',
      '+',
      '-',
      '=',
      '{',
      '}',
      '[',
      ']',
      '|',
      '\\\\',
      ';',
      '"',
      "''",
      '<',
      '>',
      ',',
      '.',
      '/',
      '~',
      '`',
    ];

    let sql = column;
    for (const char of chars) {
      sql = `REPLACE(${sql}, '${char}', '')`;
    }
    return sql;
  }

  @Get('reports/ledgers')
  async getLedgers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search: string = '',
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const query = this.ledgerRepo.createQueryBuilder('ledger');

      if (search) {
        // Strip everything except alphanumeric from search query
        const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');

        // Generate SQL to strip everything except alphanumeric from DB columns (approx)
        const cleanName = this.cleanSql('ledger.name');
        const cleanPhone = this.cleanSql('ledger.phone_number');
        const cleanGst = this.cleanSql('ledger.gstin');

        query.where(
          `(ledger.name LIKE :search 
              OR ledger.phone_number LIKE :search 
              OR ledger.gstin LIKE :search
              OR ${cleanName} LIKE :cleanSearch
              OR ${cleanPhone} LIKE :cleanSearch
              OR ${cleanGst} LIKE :cleanSearch
            )`,
          { search: `%${search}%`, cleanSearch: `%${cleanSearch}%` },
        );
      }

      const [data, total] = await query
        .orderBy('ledger.name', 'ASC')
        .skip(skip)
        .take(limitNum)
        .getManyAndCount();

      return {
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error('Error in getLedgers:', error);
      throw error;
    }
  }

  @Get('reports/stock-items/:id')
  async getStockItemById(@Param('id') id: string) {
    try {
      const item = await this.stockRepo.findOne({ where: { id: parseInt(id) } });
      if (!item) throw new Error('Stock item not found');
      return item;
    } catch (error) {
      console.error('Error in getStockItemById:', error);
      throw error;
    }
  }

  // Stock Items with pagination
  @Get('reports/stock-items')
  async getStockItems(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search: string = '',
    @Query('parent') parent: string = '',
    @Query('group') group: string = '',
    @Query('category') category: string = '',
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(10000, Math.max(1, parseInt(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const query = this.stockRepo.createQueryBuilder('stock');
      query.where('stock.is_active = true');

      if (parent) {
        const parents = parent.split(',').map(p => p.trim()).filter(Boolean);
        if (parents.length === 1) {
          query.andWhere('stock.parent = :parent', { parent: parents[0] });
        } else {
          query.andWhere('stock.parent IN (:...parents)', { parents });
        }
      }

      if (group) {
        query.andWhere('stock.group = :group', { group });
      }

      if (category) {
        const cats = category.split(',').map(c => c.trim()).filter(Boolean);
        if (cats.length === 1) {
          query.andWhere('stock.category = :category', { category: cats[0] });
        } else {
          query.andWhere('stock.category IN (:...cats)', { cats });
        }
      }

      if (search) {
        const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');
        const cleanName = this.cleanSql('stock.name');

        if (parent) {
          // Strict mode: Only search in Name when parent is already locked
          query.andWhere(
            `(stock.name LIKE :search 
              OR ${cleanName} LIKE :cleanSearch
             )`,
            {
              search: `%${search}%`,
              cleanSearch: `%${cleanSearch}%`,
            },
          );
        } else {
          // Global mode: Include Parent in search if no parent is selected
          const cleanParent = this.cleanSql('stock.parent');
          query.andWhere(
            `(stock.name LIKE :search 
              OR stock.parent LIKE :search
              OR ${cleanName} LIKE :cleanSearch
              OR ${cleanParent} LIKE :cleanSearch
             )`,
            {
              search: `%${search}%`,
              cleanSearch: `%${cleanSearch}%`,
            },
          );
        }
      }

      const [data, total] = await query
        .orderBy('stock.name', 'ASC')
        .skip(skip)
        .take(limitNum)
        .getManyAndCount();

      return {
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error('Error in getStockItems:', error);
      throw error;
    }
  }

  @Get('stock-items/brands')
  async getStockBrands(@Query('search') search: string = '') {
    try {
      const query = this.stockRepo
        .createQueryBuilder('stock')
        .select('DISTINCT stock.parent', 'brand')
        .where("stock.parent IS NOT NULL AND stock.parent != '' AND stock.is_active = true");

      if (search) {
        const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');
        const cleanBrand = this.cleanSql('stock.parent');
        query.andWhere(
          `(stock.parent LIKE :search OR ${cleanBrand} LIKE :cleanSearch)`,
          { search: `%${search}%`, cleanSearch: `%${cleanSearch}%` },
        );
      }

      const result = await query.orderBy('stock.parent', 'ASC').getRawMany();
      return result.map((r) => r.brand);
    } catch (error) {
      console.error('Error in getStockBrands:', error);
      throw error;
    }
  }

  @Get('stock-items/parents')
  async getStockParents(@Query('search') search: string = '') {
    return this.getStockBrands(search);
  }

  @Get('stock-items/groups')
  async getStockGroups(
    @Query('search') search: string = '',
    @Query('brand') brand: string = '',
  ) {
    try {
      const query = this.stockRepo
        .createQueryBuilder('stock')
        .select('DISTINCT stock.group', 'group')
        .where("stock.group IS NOT NULL AND stock.group != '' AND stock.is_active = true AND stock.group != stock.parent");

      if (brand) {
        const brands = brand.split(',').map(b => b.trim()).filter(Boolean);
        if (brands.length === 1) {
          query.andWhere('stock.parent = :brand', { brand: brands[0] });
        } else {
          query.andWhere('stock.parent IN (:...brands)', { brands });
        }
      }

      if (search) {
        const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');
        const cleanGroup = this.cleanSql('stock.group');
        query.andWhere(
          `(stock.group LIKE :search OR ${cleanGroup} LIKE :cleanSearch)`,
          { search: `%${search}%`, cleanSearch: `%${cleanSearch}%` },
        );
      }

      const result = await query.orderBy('stock.group', 'ASC').getRawMany();
      const groups = result.map((r) => r.group);

      return groups;
    } catch (error) {
      console.error('Error in getStockGroups:', error);
      throw error;
    }
  }

  @Get('stock-items/categories')
  async getStockCategories(
    @Query('search') search: string = '',
    @Query('brand') brand: string = '',
  ) {
    try {
      const query = this.stockRepo
        .createQueryBuilder('stock')
        .select('DISTINCT stock.category', 'category')
        .where("stock.category IS NOT NULL AND stock.category != '' AND stock.is_active = true");

      if (brand) {
        const brands = brand.split(',').map(b => b.trim()).filter(Boolean);
        if (brands.length === 1) {
          query.andWhere('stock.parent = :brand', { brand: brands[0] });
        } else {
          query.andWhere('stock.parent IN (:...brands)', { brands });
        }
      }

      if (search) {
        const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');
        const cleanCat = this.cleanSql('stock.category');
        query.andWhere(
          `(stock.category LIKE :search OR ${cleanCat} LIKE :cleanSearch)`,
          { search: `%${search}%`, cleanSearch: `%${cleanSearch}%` },
        );
      }

      const result = await query.orderBy('stock.category', 'ASC').getRawMany();
      let categories = result.map((r) => r.category);

      // Fallback: If no categories found, try getting distinct parents
      if (categories.length === 0) {
        const parentResult = await this.stockRepo
          .createQueryBuilder('stock')
          .select('DISTINCT stock.parent', 'parent')
          .where("stock.parent IS NOT NULL AND stock.parent != ''")
          .orderBy('stock.parent', 'ASC')
          .getRawMany();
        categories = parentResult.map((r) => r.parent);
      }

      return categories;
    } catch (error) {
      console.error('Error in getStockCategories:', error);
      throw error;
    }
  }

  // Orders with pagination
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  // 'orders' OR 'reports' — Order Processing role needs the live order list
  // to actually process orders; pure reporting users can also read it.
  @RequirePermission('orders', 'reports')
  @Get('reports/orders')
  async getOrders(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search: string = '',
    @Query('user_id') userId: string = '',
    @Query('role') role: string = '',
    @Query('show_all') showAll: string = 'false',
    @Query('date') date: string = '',
    @Query('drafts_only') draftsOnly: string = 'false', // New param
    @Query('order_type') orderType: string = '',
    @Query('range') range: string = '', // New param: 'fy'
    @Query('status') status: string = '', // New param: 'inedit', 'pending', etc.
    @Query('source') source: string = '', // New param: 'admin' or 'online'
    @Request() req: any = {},
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const query = this.orderRepo
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.ledger', 'ledger')
        .leftJoinAndSelect('order.creator', 'creator')
        .leftJoinAndSelect('order.processor', 'processor')
        .orderBy('order.date', 'DESC')
        .addOrderBy('order.created_at', 'DESC');

      // Build dynamic where clause
      let hasWhere = false;

      if (draftsOnly === 'true') {
        query.where("order.status = 'inedit'");
        hasWhere = true;

        if (role && role !== 'admin' && userId) {
          query.andWhere('order.created_by = :userId', {
            userId: parseInt(userId),
          });
        }
      } else if (search) {
        const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');
        const cleanBill = this.cleanSql('order.bill_number');
        const cleanLedgerName = this.cleanSql('ledger.name');
        const cleanCreator = this.cleanSql('creator.name');
        const cleanAmount = this.cleanSql('order.total_amount');

        query.where(
          `(${cleanBill} LIKE :cleanSearch 
              OR ${cleanLedgerName} LIKE :cleanSearch 
              OR ${cleanCreator} LIKE :cleanSearch
              OR CAST(order.id AS CHAR) LIKE :search
              OR ${cleanAmount} LIKE :cleanSearch
              OR order.date LIKE :search
              OR order.bill_number LIKE :search
              OR ledger.name LIKE :search
              OR order.customer_name LIKE :search
              OR order.customer_phone LIKE :search
            )`,
          { search: `%${search}%`, cleanSearch: `%${cleanSearch}%` },
        );
        hasWhere = true;
      } else {
        if (showAll !== 'true' && range !== 'fy') {
          // If not explicit "showAll", we hide "fetched" (Synced) orders that are older than 24 hours from the active process desk
          // However, for the process desk, we usually want to hide ALL fetched orders eventually.
          // User said: "after 24 hours of synced order it will be removed from completed order and showed on reports page"
          query.where("order.status != 'fetched' OR order.synced_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)");
          hasWhere = true;
        }
      }

      // Handle Range Filter (Financial Year)
      if (range === 'fy') {
        const today = new Date();
        const fyStart = today.getMonth() >= 3
          ? `${today.getFullYear()}-04-01`
          : `${today.getFullYear() - 1}-04-01`;
        
        if (hasWhere) query.andWhere('order.date >= :fyStart', { fyStart });
        else { query.where('order.date >= :fyStart', { fyStart }); hasWhere = true; }
        
        // When showing FY orders, we usually want to see everything including fetched
        // unless explicitly told otherwise. For now, just adding it to scope.
      }

      // Final Scoping (Staff filtering or Privacy)
      if (draftsOnly !== 'true') {
        const user = (req as any).user;
        const userPerms = user?.permissions || [];
        const hasReportsPerm = role === 'admin' || userPerms.includes('reports');
        const hasOrdersPerm = role === 'admin' || userPerms.includes('orders');

        if (role === 'admin') {
          // If explicit userId passed (clicked from dashboard)
          const filterId = parseInt(userId);
          if (!isNaN(filterId) && filterId > 0) {
            const condition = 'order.created_by = :userIdFilter';
            if (hasWhere) query.andWhere(condition, { userIdFilter: filterId });
            else { query.where(condition, { userIdFilter: filterId }); hasWhere = true; }
          }
          
          if (date) {
            const condition = 'order.date = :dateFilter';
            if (hasWhere) query.andWhere(condition, { dateFilter: date });
            else { query.where(condition, { dateFilter: date }); hasWhere = true; }
          }
        } else if (role === 'employee' && userId) {
          // Employees see ONLY their own UNLESS they have 'reports' or 'orders' permission
          if (!hasReportsPerm && !hasOrdersPerm) {
            const condition = 'order.created_by = :userIdScoped';
            if (hasWhere) query.andWhere(condition, { userIdScoped: parseInt(userId) });
            else { query.where(condition, { userIdScoped: parseInt(userId) }); hasWhere = true; }
          } else {
            // If they HAVE permission, they can still filter by userId if passed
            const filterId = parseInt(userId);
            if (!isNaN(filterId) && filterId > 0) {
              const condition = 'order.created_by = :userIdFilter';
              if (hasWhere) query.andWhere(condition, { userIdFilter: filterId });
              else { query.where(condition, { userIdFilter: filterId }); hasWhere = true; }
            }
          }

          if (date) {
            const dateCondition = 'order.date = :dateScoped';
            if (hasWhere) query.andWhere(dateCondition, { dateScoped: date });
            else { query.where(dateCondition, { dateScoped: date }); hasWhere = true; }
          }
        }
      }

      // Secondary filters
      if (orderType) {
        const condition = 'order.order_type = :orderType';
        if (hasWhere) query.andWhere(condition, { orderType });
        else { query.where(condition, { orderType }); hasWhere = true; }
      }

      if (status) {
        if (status.includes(',')) {
          const statuses = status.split(',').map(s => s.trim());
          const condition = 'order.status IN (:...statuses)';
          if (hasWhere) query.andWhere(condition, { statuses });
          else { query.where(condition, { statuses }); hasWhere = true; }
        } else {
          const condition = 'order.status = :status';
          if (hasWhere) query.andWhere(condition, { status });
          else { query.where(condition, { status }); hasWhere = true; }
        }
      }

      if (source) {
        const condition = 'order.source = :sourceFilter';
        if (hasWhere) query.andWhere(condition, { sourceFilter: source });
        else { query.where(condition, { sourceFilter: source }); hasWhere = true; }
      }

      const [data, total] = await query
        .skip(skip)
        .take(limitNum)
        .getManyAndCount();

      return {
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error('Error in getOrders:', error);
      throw error;
    }
  }

  @Get('orders/customer/:phone')
  async getOrdersByCustomerPhone(
    @Param('phone') phone: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    // Match by last-10-digit identity so '+91 999...', '0999...', '999-999-9999'
    // and '9999999999' all resolve to the same customer.
    const normalized = AppController.normalizePhone(phone);
    if (!normalized) {
      throw new HttpException('phone must contain at least 10 digits', 400);
    }

    // Alias is 'o' (not 'order') because 'order' is a MySQL reserved word —
    // dodges any escape-handling edge cases inside string-template .where().
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.orderDetails', 'd')
      .where('o.customer_phone = :exact OR o.customer_phone LIKE :like', {
        exact: normalized,
        like: `%${normalized}`,
      })
      .orderBy('o.date', 'DESC')
      .addOrderBy('o.id', 'DESC');

    // Pagination is OPTIONAL — when no params are sent, return ALL the
    // customer's orders (no hardcoded cap). Cap at 1000 per page when paginating.
    if (limitStr != null) {
      const limit = Math.max(1, Math.min(1000, parseInt(limitStr, 10) || 0));
      qb.take(limit);
    }
    if (offsetStr != null) {
      const offset = Math.max(0, parseInt(offsetStr, 10) || 0);
      qb.skip(offset);
    }

    return qb.getMany();
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orders')
  @Get('orders/:id/details')
  async getOrderDetails(@Param('id') id: string) {
    const orderId = parseInt(id);
    if (isNaN(orderId)) throw new HttpException('Invalid order ID', 400);
    return this.orderDetailRepo.find({
      where: { order: { id: orderId } },
      relations: ['processor'],
    });
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orders')
  @Get('orders/:id')
  async getOrderById(@Param('id') id: string) {
    const orderId = parseInt(id);
    if (isNaN(orderId)) throw new HttpException('Invalid order ID', 400);
    return this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['ledger', 'processor'],
    });
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('reports')
  @Delete('orders/:id')
  async deleteOrder(@Param('id') id: string) {
    try {
      const orderId = parseInt(id);
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) throw new Error('Order not found');

      if (order.status !== 'inedit') {
        throw new Error(
          'Cannot delete order that is already Shared or Synced.',
        );
      }

      // Delete details first
      const details = await this.orderDetailRepo.find({
        where: { order: { id: orderId } },
      });
      await this.orderDetailRepo.remove(details);
      await this.orderRepo.remove(order);
      return { success: true };
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  @Put('orders/:id')
  async updateOrder(@Param('id') id: string, @Body() body: any) {
    try {
      const orderId = parseInt(id);
      const { ledger_id, date, total_amount, items, order_type, remark, amount_given } = body;

      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) throw new Error('Order not found');

      if (body.bill_number) {
        const existingOrder = await this.orderRepo.findOne({
          where: { bill_number: body.bill_number },
        });
        if (existingOrder && existingOrder.id !== orderId) {
          throw new Error(
            `Order with Bill Number '${body.bill_number}' already exists.`,
          );
        }
        order.bill_number = body.bill_number;
      }

      // Optional: Block update if already 'fetched' (synced to Tally)
      // Lock update if not in 'inedit'
      if (order.status !== 'inedit') {
        throw new Error('Cannot edit order that is already Shared or Synced.');
      }

      // Update Header
      if (ledger_id) {
        const ledger = await this.ledgerRepo.findOneBy({ id: ledger_id });
        if (ledger) {
          order.ledger = ledger;
          // Update Snapshot (User might have changed customer)
          order.customer_name = ledger.person_name || ledger.name;
          order.customer_address = ledger.address;
          order.customer_phone = ledger.phone_number;
          order.customer_email = ledger.email;
          order.customer_gstin = ledger.gstin;
          order.customer_pincode = ledger.pincode;
          order.customer_state = ledger.state;
        }
      }

      order.date = date;
      order.total_amount = total_amount;
      order.order_type = order_type || 'Tax Invoice';
      order.remark = remark;
      order.amount_given = amount_given;
      // Reset status to 'inedit' if it was 'pending' and we edited it?
      // User logic: "they will save... this inedit". Assume edit puts it back to draft.
      order.status = 'inedit';
      order.source = 'admin';

      const savedOrder = await this.orderRepo.save(order);

      // Replace Details: Delete old, Insert new
      const oldDetails = await this.orderDetailRepo.find({
        where: { order: { id: orderId } },
      });
      await this.orderDetailRepo.remove(oldDetails);
      for (const item of items) {
        const orderDetail = new OrderDetail();
        orderDetail.order = savedOrder;

        // item.name (from frontend selection) is more reliable than the DB record name
        orderDetail.item_name = item.name;
        orderDetail.rate = item.rate;
        orderDetail.unit = item.unit;
        orderDetail.quantity = item.quantity;
        orderDetail.amount = item.amount;
        orderDetail.gst = item.gst;
        orderDetail.selected_scheme = item.selected_scheme;
        orderDetail.discount_percentage = item.selected_discount;
        orderDetail.livestock_type = item.livestock_type;
        orderDetail.stock_item_id = item.masterid ?? null;
        orderDetail.parent = item.parent || null;
        orderDetail.group = item.group || null;
        orderDetail.category = item.category || null;

        await this.orderDetailRepo.save(orderDetail);
      }
      return savedOrder;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orders')
  @Post('orders/:id/sync')
  async syncOrderToTally(@Param('id') id: string) {
    try {
      // New Workflow: Just mark as PENDING
      const orderId = parseInt(id);
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) return { success: false, message: 'Order not found' };

      // Prevent Double Queueing
      if (order.status === 'pending') {
        return {
          success: true,
          message: 'Order already queued for sync',
          data: order,
        };
      }
      if (order.status === 'fetched') {
        return { success: true, message: 'Order already synced', data: order };
      }

      order.status = 'pending';
      await this.orderRepo.save(order);

      // Reload with relations to return full object for frontend update
      const updatedOrder = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['ledger'],
      });

      return {
        success: true,
        message: 'Order marked for Tally Sync',
        data: updatedOrder,
      };
    } catch (error) {
      console.error('Error in syncOrderToTally:', error);
      throw error;
    }
  }

  // Tally Pull Endpoint - Protected by API Key
  @Get('tally/pending-orders')
  async getPendingOrders(@Headers('x-api-key') apiKey: string) {
    const expectedKey = process.env.TALLY_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    const limit = 10; // Reduced to 10 to ensure minimal load per request
    console.time('fetchPendingOrders');
    const pendingOrders = await this.orderRepo.find({
      where: { status: 'pending' },
      relations: ['ledger', 'orderDetails', 'creator'], // Fetch all relations needed for XML
      order: { date: 'ASC', id: 'ASC' }, // Process oldest first
      take: limit,
    });
    console.timeEnd('fetchPendingOrders');
    console.log(`[Tally Sync] Fetching ${pendingOrders.length} pending orders`);

    const data = pendingOrders.map((order) => {
      // Safe Customer Logic: Prefer Ledger Config, Fallback to Snapshot
      const customerName =
        order.ledger?.name || order.customer_name || 'Unknown Customer';
      const creatorName = order.creator ? order.creator.username : 'Unknown';

      return {
        id: order.id,
        created_by: creatorName,
        bill_number: order.bill_number,
        date: order.date,
        total_amount: order.total_amount,
        order_type: order.order_type || 'Tax Invoice',
        remark: order.remark,
        amount_given: order.amount_given,

        customer: {
          name: customerName,
          // GUID is crucial. If present, Tally identifies existing ledger.
          // If missing, Tally should look up by Name or Create New.
          guid: order.ledger?.tally_guid || '',

          // Contact Details for Creation
          address: order.ledger?.address || order.customer_address || '',
          phone: order.ledger?.phone_number || order.customer_phone || '',
          email: order.ledger?.email || order.customer_email || '',
          gstin: order.ledger?.gstin || order.customer_gstin || '',
          pincode: order.ledger?.pincode || '',
          state: order.ledger?.state || '',
          contact_person: order.ledger?.person_name || customerName,
        },

        items: order.orderDetails
          ? order.orderDetails.map((item) => ({
              stock_item_name: item.item_name, // This MUST match Tally Stock Item Name
              quantity: item.quantity,
              rate: item.rate,
              unit: item.unit,
              amount: item.amount,
              discount_percentage: item.discount_percentage,
              gst: item.gst,
              godown: item.livestock_type || 'Shop',
              parent: item.parent,
              group: item.group,
            }))
          : [],
      };
    });

    return { data };
  }

  @Get('tally/confirm-orders')
  confirmOrdersDiag() {
    return {
      message: 'Method Not Allowed. Please use POST to confirm orders.',
      example_payload: {
        id: 1,
        bill_number: 'INV/001',
        tally_master_id: '12345',
        ledger_guid: 'optional-guid',
      },
    };
  }

  @Post('tally/confirm-orders')
  async confirmOrders(
    @Headers('x-api-key') apiKey: string,
    @Body()
    check: {
      id: number;
      bill_number: string;
      tally_master_id: string;
      ledger_guid?: string;
    },
  ) {
    const expectedKey = process.env.TALLY_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    try {
      const order = await this.orderRepo.findOne({
        where: { id: check.id },
        relations: ['ledger'],
      });

      if (!order) {
        return { id: check.id, status: 'failed', message: 'Order not found' };
      }

      // 0. Duplicate Bill Number Check
      if (check.bill_number) {
        const existingOrder = await this.orderRepo.findOne({
          where: { bill_number: check.bill_number },
        });
        if (existingOrder && existingOrder.id !== check.id) {
          console.warn(
            `[Tally Sync] Rejected confirmation for Order ${check.id} due to duplicate Bill No: ${check.bill_number}`,
          );
          return {
            id: check.id,
            status: 'failed',
            message: `Bill Number ${check.bill_number} already exists on Order ${existingOrder.id}`,
          };
        }
      }

      // 1. Update Order Details
      order.bill_number = check.bill_number;
      order.tally_master_id = check.tally_master_id;
      order.status = 'fetched'; // Mark as Completed/Synced

      // 2. Handle Customer creation/linking
      if (check.ledger_guid) {
        const ledger = order.ledger;

        if (!ledger || !ledger.tally_guid) {
          let existingLedger = await this.ledgerRepo.findOne({
            where: { tally_guid: check.ledger_guid },
          });

          if (!existingLedger) {
            const customerName =
              order.customer_name || (ledger ? ledger.name : '');
            if (customerName) {
              existingLedger = await this.ledgerRepo.findOne({
                where: { name: customerName },
              });
            }
          }

          if (existingLedger) {
            existingLedger.tally_guid = check.ledger_guid;
            await this.ledgerRepo.save(existingLedger);
            order.ledger = existingLedger;
          } else {
            const newLedger = new Ledger();
            newLedger.name = order.customer_name || 'Unknown';
            newLedger.tally_guid = check.ledger_guid;
            newLedger.address = order.customer_address;
            newLedger.phone_number = order.customer_phone;
            newLedger.email = order.customer_email;
            newLedger.gstin = order.customer_gstin;
            newLedger.person_name = order.customer_name;

            const savedLedger = await this.ledgerRepo.save(newLedger);
            order.ledger = savedLedger;
          }
        }
      }

      await this.orderRepo.save(order);
      return { id: check.id, status: 'success' };
    } catch (e) {
      console.error(`Failed to confirm order ${check.id}`, e);
      return { id: check.id, status: 'error', message: e.message };
    }
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  // 'orders' OR 'reports' — listing the customers who placed online orders
  // is part of the order-processing workflow, not just historical reporting.
  @RequirePermission('orders', 'reports')
  @Get('reports/customers-online')
  async getOnlineCustomers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search: string = '',
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const query = this.orderRepo
        .createQueryBuilder('order')
        .select('order.customer_phone', 'phone')
        .addSelect('MAX(order.customer_name)', 'name')
        .addSelect('MAX(order.customer_address)', 'address')
        .addSelect('MAX(order.date)', 'lastOrderDate')
        .addSelect('COUNT(order.id)', 'orderCount')
        .addSelect('SUM(order.total_amount)', 'totalValue')
        .where("order.source = 'online'")
        .groupBy('order.customer_phone');

      if (search) {
        query.andWhere(
          '(order.customer_name LIKE :search OR order.customer_phone LIKE :search)',
          { search: `%${search}%` },
        );
      }

      const totalResult = await query.getRawMany();
      const total = totalResult.length;

      const data = await query
        .orderBy('lastOrderDate', 'DESC')
        .offset(skip)
        .limit(limitNum)
        .getRawMany();

      return {
        data: data.map(d => ({
            name: d.name,
            phone: d.phone,
            address: d.address,
            lastOrderDate: d.lastOrderDate,
            orderCount: parseInt(d.orderCount),
            totalValue: parseFloat(d.totalValue)
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error('Error in getOnlineCustomers:', error);
      throw error;
    }
  }
}
