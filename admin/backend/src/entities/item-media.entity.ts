import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('media')
export class ItemMedia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  masterid: string;

  @Column()
  type: string; // 'image' | 'video'

  @Column()
  slot: string; // 'img1', 'img2', 'vid1'

  @Column()
  url_name: string; // e.g. '001627img1'

  @Column({ nullable: true })
  uploaded_by: number;

  @CreateDateColumn()
  uploaded_at: Date;
}
