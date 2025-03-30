import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

// Import type for autoTable
import { UserOptions } from 'jspdf-autotable'

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

export interface InvoiceItem {
  name: string;
  price: number;
  quantity: number;
  productId: string | number;
  image?: string;
}

export interface ShippingAddress {
  fullName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

export interface OrderData {
  id: string | number;
  items: InvoiceItem[];
  totalAmount: number;
  createdAt: string | Date;
  paymentStatus: string;
  status: string;
  shippingAddress: ShippingAddress;
  trackingNumber?: string | null;
}

export const generateInvoice = (order: OrderData) => {
  // Initialize jsPDF with type casting to include autoTable
  const doc = new jsPDF() as JsPDFWithAutoTable;
  
  // Set up some basic variables
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const maxLineWidth = pageWidth - (margin * 2);
  
  // Add logo and company info at the top
  doc.setFontSize(22);
  doc.setTextColor(219, 112, 147); // Pink color for SoftGirlFashion
  doc.text("SoftGirlFashion", margin, 20);
  
  // Reset to default color
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text("Website: www.softgirlfashion.com", margin, 30);
  doc.text("Email: support@softgirlfashion.com", margin, 35);
  doc.text("Phone: +1 (555) 123-4567", margin, 40);
  
  // Add Invoice title and number
  doc.setFontSize(18);
  doc.text("INVOICE", pageWidth - margin - 40, 20);
  doc.setFontSize(10);
  doc.text(`Invoice Number: INV-${order.id}`, pageWidth - margin - 70, 30);
  doc.text(`Date: ${format(new Date(order.createdAt), 'MMMM d, yyyy')}`, pageWidth - margin - 70, 35);
  doc.text(`Order Status: ${order.status.toUpperCase()}`, pageWidth - margin - 70, 40);
  
  // Add a line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, 45, pageWidth - margin, 45);
  
  // Add billing and shipping details
  doc.setFontSize(12);
  doc.text("Bill To:", margin, 55);
  doc.setFontSize(10);
  doc.text(order.shippingAddress.fullName, margin, 62);
  doc.text(order.shippingAddress.address, margin, 67);
  doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`, margin, 72);
  doc.text(order.shippingAddress.country, margin, 77);
  doc.text(`Phone: ${order.shippingAddress.phone}`, margin, 82);
  
  // If there's a tracking number, add it
  if (order.trackingNumber) {
    doc.setFontSize(10);
    doc.text("Tracking Number:", pageWidth - margin - 70, 55);
    doc.text(order.trackingNumber, pageWidth - margin - 70, 62);
  }
  
  // Add order items table
  const tableColumn = ["Item", "Price", "Quantity", "Total"];
  const tableRows = order.items.map(item => [
    item.name,
    `$${(item.price || 0).toFixed(2)}`,
    item.quantity.toString(),
    `$${((item.price || 0) * item.quantity).toFixed(2)}`
  ]);
  
  // Add summary row
  tableRows.push([
    "", "", "Subtotal:", `$${order.totalAmount.toFixed(2)}`
  ]);
  
  const shippingCost = order.totalAmount >= 99 ? 0 : 7.99;
  tableRows.push([
    "", "", "Shipping:", `$${shippingCost.toFixed(2)}`
  ]);
  
  const total = order.totalAmount;
  tableRows.push([
    "", "", "Total:", `$${total.toFixed(2)}`
  ]);
  
  // Add the table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 95,
    styles: { 
      fontSize: 10,
      cellPadding: 5,
      overflow: 'linebreak',
      halign: 'left',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [219, 112, 147],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    bodyStyles: {
      fillColor: [255, 255, 255]
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto', halign: 'right' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 'auto', halign: 'right' }
    }
  });
  
  // Add footer
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  doc.setFontSize(10);
  doc.text("Thank you for shopping with SoftGirlFashion!", margin, finalY + 10);
  doc.text("For any questions, please contact our customer service at support@softgirlfashion.com", margin, finalY + 15);
  
  // Add a nicely styled section at the bottom
  doc.setDrawColor(219, 112, 147);
  doc.setLineWidth(0.5);
  doc.line(margin, finalY + 25, pageWidth - margin, finalY + 25);
  
  doc.setFontSize(9);
  doc.text("SoftGirlFashion © " + new Date().getFullYear() + " - All Rights Reserved", margin, finalY + 30);
  
  // Generate a PDF name
  const pdfName = `SoftGirlFashion_Invoice_${order.id}.pdf`;
  
  // Save the PDF
  return {
    doc,
    pdfName,
    download: () => doc.save(pdfName)
  };
};