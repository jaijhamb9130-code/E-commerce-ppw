import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Address } from './address.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ unique: true })
  phone_number: string;

  @Column({ nullable: true })
  shop_no: string;

  @Column({ nullable: true })
  email: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Address, address => address.customer)
  addresses: Address[];
}
