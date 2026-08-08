"use client"

import * as React from "react"

import { mockPurchaseBills, mockPurchaseSuppliers } from "@/lib/purchases/mock-data"
import type {
  Gstr2bStatus,
  PurchaseBill,
  PurchaseModuleNotice,
  PurchaseSupplier,
} from "@/lib/purchases/types"
import {
  createPurchaseNotice,
  getSaveSuccessMessage,
} from "@/lib/purchases/utils"

type PurchasesContextValue = {
  bills: PurchaseBill[]
  suppliers: PurchaseSupplier[]
  notice: PurchaseModuleNotice | null
  setNotice: (notice: PurchaseModuleNotice | null) => void
  getBillById: (id: string) => PurchaseBill | null
  saveBill: (bill: PurchaseBill) => PurchaseBill
  duplicateBill: (id: string) => PurchaseBill | null
  deleteBill: (id: string) => void
  updateGstr2bStatus: (id: string, status: Gstr2bStatus) => void
  markAsReconciled: (id: string) => void
  addSupplier: (supplier: PurchaseSupplier) => void
  getNextBillNumber: () => string
}

const PurchasesContext = React.createContext<PurchasesContextValue | null>(null)

function getNextBillNumberFromBills(bills: PurchaseBill[]) {
  const numbers = bills
    .map((bill) => Number(bill.billNumber.split("-").at(-1)))
    .filter((value) => Number.isFinite(value))
  const nextSerial = (Math.max(0, ...numbers) + 1).toString().padStart(4, "0")

  return `PUR-${new Date().getFullYear()}-${nextSerial}`
}

export function PurchasesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [bills, setBills] = React.useState<PurchaseBill[]>(mockPurchaseBills)
  const [suppliers, setSuppliers] = React.useState<PurchaseSupplier[]>(mockPurchaseSuppliers)
  const [notice, setNotice] = React.useState<PurchaseModuleNotice | null>(null)

  const getBillById = React.useCallback(
    (id: string) => bills.find((bill) => bill.id === id) ?? null,
    [bills]
  )

  const saveBill = React.useCallback((bill: PurchaseBill) => {
    let savedBill = bill

    setBills((currentBills) => {
      const existingIndex = currentBills.findIndex((item) => item.id === bill.id)
      if (existingIndex === -1) {
        savedBill = {
          ...bill,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        return [savedBill, ...currentBills]
      }

      savedBill = {
        ...bill,
        updatedAt: new Date().toISOString(),
      }

      return currentBills.map((item) => (item.id === bill.id ? savedBill : item))
    })

    setNotice(getSaveSuccessMessage(savedBill))
    return savedBill
  }, [])

  const duplicateBill = React.useCallback(
    (id: string) => {
      const billToDuplicate = bills.find((bill) => bill.id === id)

      if (!billToDuplicate) {
        return null
      }

      const duplicatedId = crypto.randomUUID()
      const duplicatedBillNumber = getNextBillNumberFromBills(bills)
      const duplicatedBill: PurchaseBill = {
        ...billToDuplicate,
        id: duplicatedId,
        billNumber: duplicatedBillNumber,
        supplierInvoiceNumber: `${billToDuplicate.supplierInvoiceNumber}-COPY`,
        gstr2bStatus: billToDuplicate.isRcm ? "not_applicable" : "pending",
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lineItems: billToDuplicate.lineItems.map((lineItem, index) => ({
          ...lineItem,
          id: `${duplicatedId}_line_${index + 1}`,
          purchaseBillId: duplicatedId,
        })),
      }

      setBills((currentBills) => [duplicatedBill, ...currentBills])
      setNotice(
        createPurchaseNotice(
          "Draft duplicated",
          `Bill ${duplicatedBill.billNumber} is ready as a new draft copy.`,
          "info"
        )
      )

      return duplicatedBill
    },
    [bills]
  )

  const deleteBill = React.useCallback((id: string) => {
    setBills((currentBills) => currentBills.filter((bill) => bill.id !== id))
    setNotice(
      createPurchaseNotice(
        "Draft deleted",
        "The draft purchase bill has been removed from the register.",
        "warning"
      )
    )
  }, [])

  const updateGstr2bStatus = React.useCallback((id: string, status: Gstr2bStatus) => {
    setBills((currentBills) =>
      currentBills.map((bill) =>
        bill.id === id ?
          {
            ...bill,
            gstr2bStatus: status,
            updatedAt: new Date().toISOString(),
          }
        : bill
      )
    )
    setNotice(
      createPurchaseNotice(
        "GSTR-2B status updated",
        `The bill has been marked as ${status.replaceAll("_", " ")}.`,
        "info"
      )
    )
  }, [])

  const markAsReconciled = React.useCallback((id: string) => {
    setBills((currentBills) =>
      currentBills.map((bill) =>
        bill.id === id ?
          {
            ...bill,
            status: "reconciled",
            updatedAt: new Date().toISOString(),
          }
        : bill
      )
    )
    setNotice(
      createPurchaseNotice(
        "Bill reconciled",
        "The purchase bill has been marked as reconciled.",
        "success"
      )
    )
  }, [])

  const addSupplier = React.useCallback((supplier: PurchaseSupplier) => {
    setSuppliers((currentSuppliers) =>
      currentSuppliers.some((item) => item.gstin === supplier.gstin) ?
        currentSuppliers
      : [supplier, ...currentSuppliers]
    )
  }, [])

  const contextValue = React.useMemo<PurchasesContextValue>(
    () => ({
      bills,
      suppliers,
      notice,
      setNotice,
      getBillById,
      saveBill,
      duplicateBill,
      deleteBill,
      updateGstr2bStatus,
      markAsReconciled,
      addSupplier,
      getNextBillNumber: () => getNextBillNumberFromBills(bills),
    }),
    [
      addSupplier,
      bills,
      deleteBill,
      duplicateBill,
      getBillById,
      markAsReconciled,
      notice,
      saveBill,
      suppliers,
      updateGstr2bStatus,
    ]
  )

  return (
    <PurchasesContext.Provider value={contextValue}>
      {children}
    </PurchasesContext.Provider>
  )
}

export function usePurchases() {
  const context = React.useContext(PurchasesContext)

  if (!context) {
    throw new Error("usePurchases must be used within PurchasesProvider.")
  }

  return context
}
