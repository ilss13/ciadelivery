import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'branding_configs' })
export class BrandingConfigEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 160 })
  displayName!: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'favicon_url', type: 'varchar', length: 500, nullable: true })
  faviconUrl!: string | null;

  @Column({ name: 'banner_url', type: 'varchar', length: 500, nullable: true })
  bannerUrl!: string | null;

  @Column({ name: 'primary_color', type: 'char', length: 7 })
  primaryColor!: string;

  @Column({ name: 'secondary_color', type: 'char', length: 7 })
  secondaryColor!: string;

  @Column({ name: 'accent_color', type: 'char', length: 7 })
  accentColor!: string;

  @Column({ name: 'font_family', type: 'varchar', length: 80, nullable: true })
  fontFamily!: string | null;

  @Column({ name: 'seo_title', type: 'varchar', length: 180 })
  seoTitle!: string;

  @Column({ name: 'seo_description', type: 'varchar', length: 320 })
  seoDescription!: string;

  @Column({
    name: 'instagram_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  instagramUrl!: string | null;

  @Column({ name: 'facebook_url', type: 'varchar', length: 500, nullable: true })
  facebookUrl!: string | null;

  @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true })
  websiteUrl!: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail!: string | null;

  @Column({
    name: 'whatsapp_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  whatsappPhone!: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
