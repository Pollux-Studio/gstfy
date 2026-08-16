alter table "public"."sales_invoice_lines"
  add column if not exists "taxability" text not null default 'TAXABLE',
  add column if not exists "classification" text,
  add column if not exists "cgst_rate" numeric(5, 2) not null default 0,
  add column if not exists "sgst_rate" numeric(5, 2) not null default 0,
  add column if not exists "igst_rate" numeric(5, 2) not null default 0,
  add column if not exists "cess_rule_id" text,
  add column if not exists "tax_rule_id" text,
  add column if not exists "tax_rule_version" text not null default 'GSTFY_TAX_V1',
  add column if not exists "reverse_charge" boolean not null default false,
  add column if not exists "round_off" numeric(14, 2) not null default 0;

alter table "public"."purchase_bill_lines"
  add column if not exists "taxability" text not null default 'TAXABLE',
  add column if not exists "classification" text,
  add column if not exists "cgst_rate" numeric(5, 2) not null default 0,
  add column if not exists "sgst_rate" numeric(5, 2) not null default 0,
  add column if not exists "igst_rate" numeric(5, 2) not null default 0,
  add column if not exists "cess_rule_id" text,
  add column if not exists "tax_rule_id" text,
  add column if not exists "tax_rule_version" text not null default 'GSTFY_TAX_V1',
  add column if not exists "reverse_charge" boolean not null default false,
  add column if not exists "round_off" numeric(14, 2) not null default 0;

alter table "public"."pos_sale_lines"
  add column if not exists "taxability" text not null default 'TAXABLE',
  add column if not exists "classification" text,
  add column if not exists "cgst_rate" numeric(5, 2) not null default 0,
  add column if not exists "sgst_rate" numeric(5, 2) not null default 0,
  add column if not exists "igst_rate" numeric(5, 2) not null default 0,
  add column if not exists "cess_rule_id" text,
  add column if not exists "tax_rule_id" text,
  add column if not exists "tax_rule_version" text not null default 'GSTFY_TAX_V1',
  add column if not exists "reverse_charge" boolean not null default false,
  add column if not exists "round_off" numeric(14, 2) not null default 0;

update "public"."sales_invoice_lines"
set
  "classification" = case when "igst_amount" > 0 then 'INTER_STATE' else 'INTRA_STATE' end,
  "cgst_rate" = case when "taxable_value" > 0 then round(("cgst_amount" * 100) / "taxable_value", 2) else 0 end,
  "sgst_rate" = case when "taxable_value" > 0 then round(("sgst_amount" * 100) / "taxable_value", 2) else 0 end,
  "igst_rate" = case when "taxable_value" > 0 then round(("igst_amount" * 100) / "taxable_value", 2) else 0 end
where "classification" is null;

update "public"."purchase_bill_lines"
set
  "classification" = case when "igst_amount" > 0 then 'INTER_STATE' else 'INTRA_STATE' end,
  "cgst_rate" = case when "taxable_value" > 0 then round(("cgst_amount" * 100) / "taxable_value", 2) else 0 end,
  "sgst_rate" = case when "taxable_value" > 0 then round(("sgst_amount" * 100) / "taxable_value", 2) else 0 end,
  "igst_rate" = case when "taxable_value" > 0 then round(("igst_amount" * 100) / "taxable_value", 2) else 0 end
where "classification" is null;

update "public"."pos_sale_lines"
set
  "classification" = case when "igst_amount" > 0 then 'INTER_STATE' else 'INTRA_STATE' end,
  "cgst_rate" = case when "taxable_value" > 0 then round(("cgst_amount" * 100) / "taxable_value", 2) else 0 end,
  "sgst_rate" = case when "taxable_value" > 0 then round(("sgst_amount" * 100) / "taxable_value", 2) else 0 end,
  "igst_rate" = case when "taxable_value" > 0 then round(("igst_amount" * 100) / "taxable_value", 2) else 0 end
where "classification" is null;
