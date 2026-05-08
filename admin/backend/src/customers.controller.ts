import { Controller, Post, Body, Get, Param, Patch, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { Address } from './entities/address.entity';

@Controller('customers')
export class CustomersController {
  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Address) private addressRepo: Repository<Address>,
  ) {}

  // Strip non-digits, take last 10. Treats '+91 9999999999', '09999999999',
  // '999-999-9999' and '9999999999' as the same identity.
  // Returns null when the input has fewer than 10 digits.
  static normalizePhone(input: any): string | null {
    if (input == null) return null;
    const digits = String(input).replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.slice(-10);
  }

  // Find a customer whose phone matches the normalized 10-digit form, even
  // if the stored value carries a country-code prefix or formatting.
  private async findCustomerByPhone(normalized: string): Promise<Customer | null> {
    return this.customerRepo
      .createQueryBuilder('c')
      .where('c.phone_number = :exact OR c.phone_number LIKE :like', {
        exact: normalized,
        like: `%${normalized}`,
      })
      .getOne();
  }

  // Create-only endpoint used by the customer sign-up flow. Rejects (HTTP 409)
  // when the phone is already registered, so a Sign-Up cannot silently overwrite
  // an existing account. /customers/sync is kept as the upsert path for profile
  // edits and admin-driven syncs.
  @Post('register')
  async registerCustomer(@Body() body: any) {
    const { name, phone, shopName, email } = body;
    const normalized = CustomersController.normalizePhone(phone);
    if (!normalized) throw new HttpException('phone must contain at least 10 digits', 400);
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new HttpException('name is required', 400);
    }
    if (!shopName || typeof shopName !== 'string' || !shopName.trim()) {
      throw new HttpException('shopName is required', 400);
    }

    const existing = await this.findCustomerByPhone(normalized);
    if (existing) {
      throw new HttpException(
        'This phone is already registered. Please sign in instead.',
        409,
      );
    }

    const customer = new Customer();
    customer.phone_number = normalized;
    customer.name = name.trim();
    customer.shop_no = shopName.trim();
    if (email && typeof email === 'string' && email.trim()) {
      customer.email = email.trim();
    }
    return this.customerRepo.save(customer);
  }

  @Post('sync')
  async syncCustomer(@Body() body: any) {
    const { name, phone, shopName, email } = body;
    const normalized = CustomersController.normalizePhone(phone);
    if (!normalized) throw new HttpException('phone must contain at least 10 digits', 400);

    let customer = await this.findCustomerByPhone(normalized);
    if (!customer) {
      customer = new Customer();
      customer.phone_number = normalized; // canonical 10-digit form for all new rows
      customer.name = name;
      customer.shop_no = shopName;
      if (email) customer.email = email;
      await this.customerRepo.save(customer);
    } else {
      // Update missing/changed fields. Don't rewrite phone — preserves any historical format.
      if (name) customer.name = name;
      if (shopName) customer.shop_no = shopName;
      if (email) customer.email = email;
      await this.customerRepo.save(customer);
    }

    return customer;
  }

  @Get(':phone/profile')
  async getProfile(@Param('phone') phone: string) {
    const normalized = CustomersController.normalizePhone(phone);
    if (!normalized) return null; // invalid/short phone — same UX as "not found"

    const customer = await this.customerRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.addresses', 'addresses')
      .where('c.phone_number = :exact OR c.phone_number LIKE :like', {
        exact: normalized,
        like: `%${normalized}`,
      })
      .getOne();

    if (!customer) {
      return null;
    }
    return customer;
  }

  @Post(':customer_id/addresses')
  async addAddress(@Param('customer_id') customer_id: number, @Body() body: any) {
    const { street, city, type, isDefault, name, shop_no, landmark } = body;
    
    // if isDefault, set others to false
    if (isDefault) {
        await this.addressRepo.update({ customer_id }, { is_default: false });
    }

    const address = new Address();
    address.customer_id = customer_id;
    address.address = `${street}, ${city}`;
    address.name = type; // mapping type to name or vice versa 
    address.shop_no = shop_no;
    address.landmark = landmark;
    address.is_default = isDefault || false;

    return this.addressRepo.save(address);
  }

  @Patch('addresses/:id')
  async updateAddress(@Param('id') id: number, @Body() body: any) {
      // Logic to set default address
      if (body.isDefault) {
          const addr = await this.addressRepo.findOne({ where: { id } });
          if (addr) {
             await this.addressRepo.update({ customer_id: addr.customer_id }, { is_default: false });
             addr.is_default = true;
             await this.addressRepo.save(addr);
          }
      }
      return { success: true };
  }
}
