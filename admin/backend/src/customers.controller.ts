import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
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

  @Post('sync')
  async syncCustomer(@Body() body: any) {
    const { name, phone, shopName, email } = body;
    if (!phone) throw new Error('Phone is required');

    let customer = await this.customerRepo.findOne({ where: { phone_number: phone } });
    if (!customer) {
      customer = new Customer();
      customer.phone_number = phone;
      customer.name = name;
      customer.shop_no = shopName;
      if (email) customer.email = email;
      await this.customerRepo.save(customer);
    } else {
      // update if empty
      if (name) customer.name = name;
      if (shopName) customer.shop_no = shopName;
      if (email) customer.email = email;
      await this.customerRepo.save(customer);
    }

    return customer;
  }

  @Get(':phone/profile')
  async getProfile(@Param('phone') phone: string) {
    let customer = await this.customerRepo.findOne({
      where: { phone_number: phone },
      relations: ['addresses'],
    });

    if (!customer) {
        // Return 404 implicitly or empty object to signify new customer
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
