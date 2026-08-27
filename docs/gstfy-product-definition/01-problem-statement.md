# 01 Problem Statement

## The Main Problem

Small Indian businesses are GST registered, but most owners do not understand GST filing well enough to do it confidently. They usually depend on a CA or accountant even for simple monthly or quarterly compliance.

The owner can run the business, sell products, talk to customers, and manage stock manually, but GST filing creates fear because mistakes can lead to penalties, notices, or blocked input tax credit.

## Current Market Problem

Tools like Tally Prime, Zoho Books, and Vyapar solve many accounting and business problems, but for a small dealer they often introduce extra effort:

| Tool pattern | Dealer problem |
|---|---|
| Accounting-first navigation | User must understand ledgers, vouchers, groups, debit, credit, and reports |
| Enterprise-style setup | Too many settings before the user can create a useful bill |
| Feature-heavy UI | Small shop owner sees options they do not use daily |
| CA/accountant language | User feels the software is made for accountants, not shop owners |
| Manual GST interpretation | User still needs someone to explain GSTR-1, GSTR-3B, ITC, and mismatches |

## Why This Matters

A kirana store, cycle shop, phone accessory shop, small trader, or freelancer may only need:

- GST bills.
- Purchase entry.
- Stock awareness.
- Payment follow-up.
- GST summary.
- Simple filing confidence.

But existing tools often push them into a broader accounting system before solving the basic GST anxiety.

## Problem In One Sentence

Small GST-registered businesses need compliance confidence and daily billing simplicity, but existing accounting tools are too broad, too complex, or too accountant-focused for their daily workflow.

## Business Definition Problem

Before GSTFY can serve a dealer, it must define the business clearly:

- Who owns the business?
- What is the GSTIN?
- What state does the business belong to?
- Is there one branch or multiple branches?
- Is there one warehouse or multiple stock locations?
- Does a CA manage this business or is it self-service?
- What invoice numbering and templates should be used?
- Which GST slabs and cess rules apply to the products sold?
- Which users can access sales, purchases, inventory, and GST data?

GSTFY solves this by treating the business as a tenant with structured setup:

```text
Business
-> GST registrations
-> Branches
-> Warehouses
-> Users and roles
-> Parties
-> Products
-> Documents
-> GST reports
```

## Jobs To Be Done

When I run a small GST business, I want to create valid bills, track purchases, know my stock, and prepare GST returns without learning full accounting software, so I can save CA cost and avoid compliance mistakes.

When I am a CA managing small clients, I want clean client data, referral onboarding, and filing readiness views, so I can reduce manual data collection and review multiple clients faster.

## Product Opportunity

GSTFY can win by not competing feature-by-feature with large accounting tools. It should compete on simplicity, GST correctness, and guided workflows.

The core promise:

```text
Daily business entries in.
GST-ready reports out.
Less CA dependency.
Less accounting confusion.
```

