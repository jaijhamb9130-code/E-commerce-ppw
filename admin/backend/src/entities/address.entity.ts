import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Customer, customer => customer.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column()
  customer_id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  shop_no: string;

  @Column('text')
  address: string;

  @Column({ nullable: true })
  landmark: string;

  @Column({ default: false })
  is_default: boolean;
}
