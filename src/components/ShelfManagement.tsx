import React, { useState } from 'react';
import { 
  QrCode, 
  Plus, 
  Search, 
  MapPin, 
  Printer, 
  Edit2, 
  Trash2, 
  Eye, 
  ShoppingBag, 
  Info, 
  X, 
  Check, 
  ChevronRight, 
  Map, 
  AlertCircle,
  SlidersHorizontal,
  LayoutGrid 
} from 'lucide-react';
import { Product, Shelf, UserProfile } from '../types';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';

interface ShelfManagementProps {
  products: Product[];
  shelves: Shelf[];
  currentUser: UserProfile;
  canManageProducts: boolean;
  onRecordTransaction: (txData: any) => Promise<void>;
}

export default function ShelfManagement({ 
  products, 
  shelves, 
  currentUser, 
  canManageProducts,
  onRecordTransaction 
}: ShelfManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');
  
  // Custom modal dialog confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isAlertOnly?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'SHELVES' | 'PRODUCT_QR'>('SHELVES');

  // Product QR customization states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [showSku, setShowSku] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showUnit, setShowUnit] = useState(true);
  const [customText, setCustomText] = useState('');
  const [qrAction, setQrAction] = useState<'VIEW' | 'OUT' | 'IN'>('OUT');
  const [stickerSize, setStickerSize] = useState<'SM' | 'MD' | 'LG' | 'CUSTOM'>('MD');
  const [customCardWidth, setCustomCardWidth] = useState<number>(230);
  const [customQrSize, setCustomQrSize] = useState<number>(130);
  const [customFontSize, setCustomFontSize] = useState<number>(11);
  const [customPadding, setCustomPadding] = useState<number>(15);
  const [labelQty, setLabelQty] = useState<number>(1);

  // Queued Labels data structure
  interface QueuedLabel {
    id: string;
    product: Product;
    quantity: number;
    showSku: boolean;
    showName: boolean;
    showLocation: boolean;
    showUnit: boolean;
    customText: string;
    qrAction: 'VIEW' | 'OUT' | 'IN';
    stickerSize: 'SM' | 'MD' | 'LG' | 'CUSTOM';
    customCardWidth?: number;
    customQrSize?: number;
    customFontSize?: number;
    customPadding?: number;
  }
  const [printQueue, setPrintQueue] = useState<QueuedLabel[]>([]);

  // Shelf QR size customization states
  const [shelfStickerSize, setShelfStickerSize] = useState<'SM' | 'MD' | 'LG' | 'CUSTOM'>('MD');
  const [shelfCustomCardWidth, setShelfCustomCardWidth] = useState<number>(340);
  const [shelfCustomQrSize, setShelfCustomQrSize] = useState<number>(180);
  const [shelfCustomFontSize, setShelfCustomFontSize] = useState<number>(14);
  const [shelfCustomPadding, setShelfCustomPadding] = useState<number>(24);
  const [shelfGridColumns, setShelfGridColumns] = useState<number>(2); // 1, 2, or 3

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    zone: 'โซน A'
  });

  // Zone editing and custom zone input states
  const [isZoneEditModalOpen, setIsZoneEditModalOpen] = useState(false);
  const [zoneToRename, setZoneToRename] = useState('');
  const [renamedZoneName, setRenamedZoneName] = useState('');
  const [showCustomZoneInput, setShowCustomZoneInput] = useState(false);

  // View items modal
  const [selectedShelfForView, setSelectedShelfForView] = useState<Shelf | null>(null);

  // States for assigning products to the currently viewed shelf
  const [selectedProductIdToAssign, setSelectedProductIdToAssign] = useState<string>('');
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);

  // Assign product to shelf function
  const handleAssignProductToShelf = async (productId: string, shelfName: string) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        location: shelfName
      });
      setSuccess(`ระบุตำแหน่งสินค้าลงในชั้นวาง "${shelfName}" สำเร็จ!`);
      // Reset inputs
      setSelectedProductIdToAssign('');
      setAssignSearchQuery('');
      setIsAssignDropdownOpen(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error assigning product to shelf:', err);
      setError('ไม่สามารถย้ายตำแหน่งสินค้าได้: ' + err.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  // Remove product from shelf function
  const handleRemoveProductFromShelf = (productId: string, productName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ย้ายสินค้าออกจากตำแหน่งชั้นวาง',
      message: `คุณต้องการย้ายสินค้า "${productName}" ออกจากตำแหน่งชั้นวางนี้ใช่หรือไม่?`,
      confirmText: 'ย้ายออก',
      cancelText: 'ยกเลิก',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'products', productId), {
            location: ''
          });
          setSuccess(`ย้ายสินค้า "${productName}" ออกจากชั้นวางเรียบร้อยแล้ว`);
          setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
          console.error('Error removing product from shelf:', err);
          setError('ไม่สามารถย้ายสินค้าออกจากชั้นวางได้: ' + err.message);
          setTimeout(() => setError(''), 4000);
        } finally {
          setConfirmDialog(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  // Start zone renaming
  const handleStartRenameZone = (zoneName: string) => {
    setZoneToRename(zoneName);
    setRenamedZoneName(zoneName);
    setIsZoneEditModalOpen(true);
  };

  // Save renamed zone
  const handleSaveZoneRename = async () => {
    const trimmedNewName = renamedZoneName.trim();
    if (!trimmedNewName || trimmedNewName === zoneToRename) {
      setIsZoneEditModalOpen(false);
      return;
    }

    try {
      // Find all shelves in this zone
      const zoneShelves = shelves.filter(s => (s.zone || 'โซนทั่วไป') === zoneToRename);
      if (zoneShelves.length > 0) {
        await Promise.all(
          zoneShelves.map(shelf => 
            updateDoc(doc(db, 'shelves', shelf.id), {
              zone: trimmedNewName
            })
          )
        );
      }
      setSuccess(`เปลี่ยนชื่อโซนจาก "${zoneToRename}" เป็น "${trimmedNewName}" เรียบร้อยแล้ว (มีผลต่อ ${zoneShelves.length} ชั้นวาง)`);
      setSelectedZone(trimmedNewName);
      setIsZoneEditModalOpen(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error renaming zone:', err);
      setError('เกิดข้อผิดพลาดในการเปลี่ยนชื่อโซน: ' + err.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  // Delete Zone function (deletes shelves under this zone and unassigns products)
  const handleDeleteZone = async (zoneName: string) => {
    // Find all shelves in this zone
    const zoneShelves = shelves.filter(s => (s.zone || 'โซนทั่วไป') === zoneName);
    
    // Check if any of these shelves have products
    const shelvesWithProducts: string[] = [];
    const productsToUpdate: Product[] = [];
    const activeProductsToClear: Product[] = [];

    for (const shelf of zoneShelves) {
      const shelfProducts = getProductsForShelf(shelf.name);
      const activeProducts = shelfProducts.filter(p => p.quantity > 0);
      if (activeProducts.length > 0) {
        shelvesWithProducts.push(shelf.name);
        activeProductsToClear.push(...activeProducts);
      }
      productsToUpdate.push(...shelfProducts);
    }

    if (shelvesWithProducts.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'ยืนยันการบังคับลบโซนคลังสินค้า',
        message: `โซน "${zoneName}" มีชั้นวางสินค้าที่ยังมีสินค้าจำนวนคงเหลือตกค้างอยู่ทั้งหมด ${shelvesWithProducts.length} ชั้นวาง ได้แก่: ${shelvesWithProducts.join(', ')}\n\nหากคุณต้องการลบโซนนี้ ระบบจำเป็นต้องบังคับย้ายพิกัดจัดเก็บของสินค้าเหล่านั้น (${activeProductsToClear.length} รายการ) ออก ให้กลายเป็น "ไม่มีพิกัดจัดเก็บ" ทันที โดยยอดสินค้าคงคลังจะไม่มีการสูญหายใดๆ\n\nคุณยืนยันที่จะลบแบบบังคับใช่หรือไม่?`,
        confirmText: 'บังคับลบและเคลียร์พิกัด',
        cancelText: 'ยกเลิก',
        variant: 'danger',
        onConfirm: async () => {
          try {
            // Clear location of ALL products in these shelves (both active and empty)
            if (productsToUpdate.length > 0) {
              await Promise.all(
                productsToUpdate.map(p => updateDoc(doc(db, 'products', p.id), { location: '' }))
              );
            }

            // Delete all shelves in this zone
            if (zoneShelves.length > 0) {
              await Promise.all(zoneShelves.map(shelf => deleteDoc(doc(db, 'shelves', shelf.id))));
            }
            
            setSuccess(`ลบโซน "${zoneName}" และย้ายพิกัดสินค้าตกค้างสำเร็จเรียบร้อยแล้ว`);
            setSelectedZone('ALL');
            setTimeout(() => setSuccess(''), 3000);
          } catch (err: any) {
            console.error('Error force deleting zone:', err);
            setError('เกิดข้อผิดพลาดในการบังคับลบโซน: ' + err.message);
            setTimeout(() => setError(''), 4000);
          } finally {
            setConfirmDialog(p => ({ ...p, isOpen: false }));
          }
        }
      });
      return;
    }

    // Confirm standard deletion
    const confirmMessage = zoneShelves.length > 0 
      ? `คุณต้องการลบโซน "${zoneName}" ใช่หรือไม่? การดำเนินการนี้จะลบชั้นวางสินค้าในโซนนี้จำนวน ${zoneShelves.length} ชั้นวางออกจากระบบโดยถาวร (ระบบจะเคลียร์พิกัดของสินค้าที่มีจำนวนเป็น 0 ชิ้นโดยอัตโนมัติ)`
      : `คุณต้องการลบโซน "${zoneName}" ออกจากระบบใช่หรือไม่?`;

    setConfirmDialog({
      isOpen: true,
      title: 'ลบโซนคลังสินค้า',
      message: confirmMessage,
      confirmText: 'ลบโซน',
      cancelText: 'ยกเลิก',
      variant: 'danger',
      onConfirm: async () => {
        try {
          // Clear location of products with quantity 0
          if (productsToUpdate.length > 0) {
            await Promise.all(
              productsToUpdate.map(p => updateDoc(doc(db, 'products', p.id), { location: '' }))
            );
          }

          // Delete all empty shelves in this zone
          if (zoneShelves.length > 0) {
            await Promise.all(zoneShelves.map(shelf => deleteDoc(doc(db, 'shelves', shelf.id))));
          }
          
          setSuccess(`ลบโซน "${zoneName}" และชั้นวางที่เกี่ยวข้องเรียบร้อยแล้ว`);
          setSelectedZone('ALL');
          setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
          console.error('Error deleting zone:', err);
          setError('เกิดข้อผิดพลาดในการลบโซน: ' + err.message);
          setTimeout(() => setError(''), 4000);
        } finally {
          setConfirmDialog(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  // Print modal states
  const [printModalShelf, setPrintModalShelf] = useState<Shelf | null>(null);
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false);

  // Success/error messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get unique zones from shelves for filtering
  const zones = ['ALL', ...Array.from(new Set(shelves.map(s => s.zone || 'โซนทั่วไป').filter(Boolean)))];

  // Dynamic list of unique zones currently in shelves, plus default standard ones
  const defaultZonesList = ['โซน A', 'โซน B', 'โซน C', 'โซนทั่วไป', 'ฝากส่ง'];
  const allAvailableZones = Array.from(new Set([
    ...defaultZonesList,
    ...shelves.map(s => s.zone || 'โซนทั่วไป').filter(Boolean)
  ]));

  // Filter shelves
  const filteredShelves = shelves.filter(shelf => {
    const matchesSearch = 
      shelf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (shelf.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (shelf.zone || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesZone = selectedZone === 'ALL' || (shelf.zone || 'โซนทั่วไป') === selectedZone;
    
    return matchesSearch && matchesZone;
  });

  // Get products assigned to a shelf
  const getProductsForShelf = (shelfName: string) => {
    return products.filter(p => (p.location || '').trim().toLowerCase() === (shelfName || '').trim().toLowerCase());
  };

  // Generate product QR Code URL
  const getQrCodeUrlForProduct = (prod: Product, action: 'VIEW' | 'OUT' | 'IN') => {
    let actionParam = '';
    if (action === 'OUT') actionParam = '&action=OUT';
    if (action === 'IN') actionParam = '&action=IN';
    const webAppUrl = `${window.location.origin}?sku=${encodeURIComponent(prod.sku)}${actionParam}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(webAppUrl)}`;
  };

  // Add to print queue handler
  const handleAddToQueue = () => {
    if (!selectedProduct) {
      setError('กรุณาเลือกสินค้าที่ต้องการสร้างป้าย QR');
      return;
    }
    if (labelQty < 1) {
      setError('กรุณาระบุจำนวนป้ายที่ต้องการพิมพ์อย่างน้อย 1 ใบ');
      return;
    }

    const newItem: QueuedLabel = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      product: selectedProduct,
      quantity: labelQty,
      showSku,
      showName,
      showLocation,
      showUnit,
      customText: customText.trim(),
      qrAction,
      stickerSize,
      ...(stickerSize === 'CUSTOM' ? {
        customCardWidth,
        customQrSize,
        customFontSize,
        customPadding
      } : {})
    };

    setPrintQueue(prev => [...prev, newItem]);
    setSuccess(`เพิ่มสินค้า "${selectedProduct.name}" (${labelQty} ป้าย) เข้าสู่รายการคิวพิมพ์แล้วครับ!`);
    setTimeout(() => setSuccess(''), 3500);

    // Reset some states for convenient next entries
    setSelectedProduct(null);
    setProdSearchQuery('');
    setLabelQty(1);
    setCustomText('');
  };

  // Centralized robust printing function (Bypasses Sandbox / Popup Blockers in iframe)
  const printHtmlContent = (htmlContent: string) => {
    // Attempt window.open first
    try {
      // Calculate dynamic popup window size to be flexible according to the screen size
      const screenWidth = typeof window !== 'undefined' ? window.screen.width : 1024;
      const screenHeight = typeof window !== 'undefined' ? window.screen.height : 768;
      
      // Set size to 90% of screen size, but max out at 950px width and 850px height
      const width = Math.min(950, Math.floor(screenWidth * 0.9));
      const height = Math.min(850, Math.floor(screenHeight * 0.9));
      
      // Center the popup window on screen
      const left = Math.max(0, Math.floor((screenWidth - width) / 2));
      const top = Math.max(0, Math.floor((screenHeight - height) / 2));

      const printWindow = window.open('', '', `height=${height},width=${width},left=${left},top=${top},resizable=yes,scrollbars=yes`);
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        return;
      }
    } catch (e) {
      console.warn("window.open blocked or failed, using silent iframe printer", e);
    }

    // Fallback: Silent Inline iframe printing (Doesn't require popups!)
    const existing = document.getElementById('silent-print-iframe') as HTMLIFrameElement;
    if (existing) {
      existing.parentNode?.removeChild(existing);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'silent-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setSuccess("🖨️ ตรวจพบว่าเบราว์เซอร์บล็อกป๊อปอัปในหน้าจอนี้: กำลังสั่งพิมพ์สติกเกอร์ผ่านช่องทางสำรองโดยตรง...");
      setTimeout(() => setSuccess(''), 4500);

      if (iframe.contentWindow) {
        const win = iframe.contentWindow;
        win.focus();
        // Give external QR codes 800ms to load before opening print window
        setTimeout(() => {
          win.print();
        }, 800);
      }
    }
  };

  // Print all queued stickers
  const handlePrintQueue = () => {
    if (printQueue.length === 0) return;

    let gridHtml = '';
    printQueue.forEach((item) => {
      const qrUrl = getQrCodeUrlForProduct(item.product, item.qrAction);
      
      let cardStyle = '';
      let imgStyle = '';
      let textStyle = '';
      
      if (item.stickerSize === 'SM') {
        cardStyle = 'width: 175px; padding: 10px; margin: 3px;';
        imgStyle = 'width: 90px; height: 90px;';
        textStyle = 'font-size: 10px;';
      } else if (item.stickerSize === 'LG') {
        cardStyle = 'width: 300px; padding: 22px; margin: 8px;';
        imgStyle = 'width: 170px; height: 170px;';
        textStyle = 'font-size: 13px;';
      } else if (item.stickerSize === 'CUSTOM') {
        const cw = item.customCardWidth || 230;
        const cq = item.customQrSize || 130;
        const cf = item.customFontSize || 11;
        const cp = item.customPadding || 15;
        cardStyle = `width: ${cw}px; padding: ${cp}px; margin: 5px;`;
        imgStyle = `width: ${cq}px; height: ${cq}px;`;
        textStyle = `font-size: ${cf}px;`;
      } else { // MD
        cardStyle = 'width: 230px; padding: 15px; margin: 5px;';
        imgStyle = 'width: 130px; height: 130px;';
        textStyle = 'font-size: 11px;';
      }

      const actionText = 
        item.qrAction === 'OUT' ? 'สแกนตัดเบิกทันที (OUT)' :
        item.qrAction === 'IN' ? 'สแกนรับเข้าสต๊อก (IN)' :
        'สแกนตรวจสอบสินค้า';

      const actionColor = 
        item.qrAction === 'OUT' ? '#e11d48' : 
        item.qrAction === 'IN' ? '#16a34a' : 
        '#2563eb';

      for (let i = 0; i < item.quantity; i++) {
        gridHtml += `
          <div class="sticker-card" style="${cardStyle}">
            <div style="font-size: 9px; font-weight: bold; color: #777; text-transform: uppercase; margin-bottom: 2px;">
              ${item.product.category || 'คลังสินค้า'}
            </div>
            ${item.showName ? `
              <div style="font-size: 11px; font-weight: 800; color: #000; margin-bottom: 4px; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 26px;">
                ${item.product.name}
              </div>
            ` : '<div style="height: 10px;"></div>'}
            
            <img src="${qrUrl}" alt="QR Code" style="${imgStyle} display: block; margin: 6px auto; border: 1px solid #ddd; padding: 3px; border-radius: 4px; background: #fff;" />
            
            <div style="background: ${actionColor}; color: white; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px; display: inline-block; margin: 2px auto;">
              ${actionText}
            </div>

            <div style="${textStyle} color: #333; margin-top: 4px; border-top: 1px dashed #ddd; padding-top: 4px; text-align: left; line-height: 1.3;">
              ${item.showSku ? `<div><strong>SKU:</strong> ${item.product.sku}</div>` : ''}
              ${item.showLocation ? `<div><strong>พิกัด:</strong> ${item.product.location || 'ไม่มี'}</div>` : ''}
              ${item.showUnit ? `<div><strong>หน่วย:</strong> ${item.product.unit}</div>` : ''}
              ${item.customText ? `<div style="margin-top: 3px; font-weight: bold; color: #ea580c; border-top: 1px dotted #eee; padding-top: 2px;">⚠️ ${item.customText}</div>` : ''}
            </div>
          </div>
        `;
      }
    });

    const fullHtml = `
      <html>
        <head>
          <title>พิมพ์ป้าย QR Code ติดสินค้า</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 15px;
              text-align: center;
              background-color: #white;
            }
            .print-btn {
              background-color: #2563eb;
              color: white;
              border: none;
              padding: 10px 20px;
              font-size: 13px;
              font-weight: bold;
              border-radius: 5px;
              cursor: pointer;
              margin-bottom: 20px;
              font-family: inherit;
            }
            .stickers-container {
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              gap: 10px;
            }
            .sticker-card {
              border: 1px dashed #777;
              border-radius: 6px;
              background: #fff;
              box-sizing: border-box;
              text-align: center;
              page-break-inside: avoid;
            }
            @media print {
              .print-btn { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">🖨️ กดพิมพ์สติกเกอร์ (หรือ บันทึก PDF)</button>
          <div class="stickers-container">
            ${gridHtml}
          </div>
        </body>
      </html>
    `;

    printHtmlContent(fullHtml);
  };


  // Handle Form Submission (Add/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('กรุณาระบุชื่อหรือรหัสชั้นวางสินค้า');
      return;
    }

    // Check duplicate name for new shelves
    if (!editingShelf && shelves.some(s => s.name.trim().toLowerCase() === formData.name.trim().toLowerCase())) {
      setError('ชื่อหรือรหัสชั้นวางนี้มีอยู่ในระบบแล้ว');
      return;
    }

    try {
      const shelfId = editingShelf ? editingShelf.id : `shelf-${Date.now()}`;
      const shelfData: Shelf = {
        id: shelfId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        zone: formData.zone.trim(),
        createdAt: editingShelf?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'shelves', shelfId), shelfData);
      
      setSuccess(editingShelf ? 'แก้ไขข้อมูลชั้นวางสำเร็จ!' : 'เพิ่มชั้นวางใหม่เข้าสู่คลังสำเร็จ!');
      setIsFormOpen(false);
      setEditingShelf(null);
      setFormData({ name: '', description: '', zone: 'โซน A' });

      // Auto clear alert
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error('Error saving shelf:', err);
      setError('ไม่สามารถบันทึกชั้นวางได้: ' + (err.message || String(err)));
    }
  };

  // Open Edit Shelf Modal
  const handleEditClick = (shelf: Shelf) => {
    setEditingShelf(shelf);
    setFormData({
      name: shelf.name,
      description: shelf.description || '',
      zone: shelf.zone || 'โซน A'
    });
    setShowCustomZoneInput(false);
    setIsFormOpen(true);
  };

  // Delete Shelf
  const handleDeleteShelf = async (shelfId: string, shelfName: string) => {
    // Check if there are active products stored on this shelf (quantity > 0)
    const shelfProducts = getProductsForShelf(shelfName);
    const activeProducts = shelfProducts.filter(p => p.quantity > 0);
    if (activeProducts.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'ไม่สามารถลบชั้นวางได้',
        message: `ไม่สามารถลบชั้นวาง "${shelfName}" ได้ เนื่องจากมีสินค้าที่มีจำนวนคงเหลือค้างอยู่ในพิกัดนี้ทั้งหมด ${activeProducts.length} รายการ กรุณาย้ายหรือจำหน่ายพิกัดสินค้าออกก่อนลบครับ`,
        confirmText: 'ตกลง',
        variant: 'warning',
        isAlertOnly: true,
        onConfirm: () => setConfirmDialog(p => ({ ...p, isOpen: false }))
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบชั้นวางสินค้า',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบชั้นวางสินค้า "${shelfName}" ออกจากระบบ? (สินค้าที่เคยระบุพิกัดนี้แต่จำนวนคงเหลือเป็น 0 จะถูกเคลียร์พิกัดโดยอัตโนมัติ)`,
      confirmText: 'ลบชั้นวาง',
      cancelText: 'ยกเลิก',
      variant: 'danger',
      onConfirm: async () => {
        try {
          // Clear location of products with quantity <= 0 that point to this shelf
          const emptyProducts = shelfProducts.filter(p => p.quantity <= 0);
          if (emptyProducts.length > 0) {
            await Promise.all(
              emptyProducts.map(p => updateDoc(doc(db, 'products', p.id), { location: '' }))
            );
          }

          await deleteDoc(doc(db, 'shelves', shelfId));
          setSuccess('ลบชั้นวางสินค้าเรียบร้อยแล้ว');
          setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
          setError('เกิดข้อผิดพลาดในการลบ: ' + err.message);
        } finally {
          setConfirmDialog(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  // Generate QR code URL
  const getQrCodeUrlForShelf = (shelf: Shelf) => {
    const webAppUrl = window.location.origin + '?shelf=' + encodeURIComponent(shelf.id);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(webAppUrl)}`;
  };

  const triggerPrint = () => {
    const printContent = document.getElementById('printable-area');
    if (!printContent) return;

    const cardWidth = shelfStickerSize === 'CUSTOM' ? shelfCustomCardWidth : shelfStickerSize === 'SM' ? 260 : shelfStickerSize === 'LG' ? 420 : 340;
    const qrSize = shelfStickerSize === 'CUSTOM' ? shelfCustomQrSize : shelfStickerSize === 'SM' ? 120 : shelfStickerSize === 'LG' ? 240 : 180;
    const fontSize = shelfStickerSize === 'CUSTOM' ? shelfCustomFontSize : shelfStickerSize === 'SM' ? 11 : shelfStickerSize === 'LG' ? 17 : 14;
    const padding = shelfStickerSize === 'CUSTOM' ? shelfCustomPadding : shelfStickerSize === 'SM' ? 16 : shelfStickerSize === 'LG' ? 32 : 24;

    const fullHtml = `
      <html>
        <head>
          <title>พิมพ์ป้ายชั้นวางสินค้า QR Code</title>
          <style>
            body { 
              font-family: 'Helvetica Neue', Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: #fff;
              text-align: center;
            }
            .print-card {
              border: 4px solid #333;
              border-radius: 16px;
              padding: ${padding}px;
              margin: 10px auto;
              max-width: ${cardWidth}px;
              background: #fff;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              page-break-inside: avoid;
            }
            .title { 
              font-size: ${fontSize + 14}px; 
              font-weight: bold; 
              margin: 0 0 5px 0; 
              color: #000;
              letter-spacing: 1px;
            }
            .subtitle { 
              font-size: ${fontSize - 2}px; 
              color: #666; 
              margin: 0 0 20px 0;
              text-transform: uppercase;
              font-weight: bold;
            }
            .qr-image { 
              width: ${qrSize}px; 
              height: ${qrSize}px; 
              margin: 15px auto;
              display: block;
            }
            .description { 
              font-size: ${fontSize - 1}px; 
              color: #444; 
              margin-top: 15px;
              border-top: 1px dashed #ccc;
              padding-top: 15px;
              line-height: 1.4;
            }
            .footer-text {
              font-size: ${fontSize - 4}px;
              color: #888;
              margin-top: 10px;
            }
            .btn-print-trigger {
              background-color: #2563eb;
              color: white;
              border: none;
              padding: 10px 20px;
              font-size: 14px;
              font-weight: bold;
              border-radius: 6px;
              cursor: pointer;
              margin-bottom: 20px;
            }
            @media print {
              .btn-print-trigger { display: none; }
              body { padding: 0; }
              .print-card { 
                box-shadow: none; 
                border: 3px solid #000; 
                margin: 20px auto; 
              }
            }
          </style>
        </head>
        <body>
          <button class="btn-print-trigger" onclick="window.print()">กดปุ่มนี้เพื่อพิมพ์ / บันทึก PDF</button>
          <div id="print-container">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `;

    printHtmlContent(fullHtml);
  };

  return (
    <div className="space-y-6" id="shelf-mgmt-root">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <QrCode className="w-5 h-5 animate-bounce" />
            </div>
            <span>{activeTab === 'SHELVES' ? 'จัดการผังชั้นวางสินค้า (Shelves & Locations)' : 'เครื่องมือสร้างป้าย QR Code ติดสินค้ารายชิ้น'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'SHELVES' 
              ? 'ระบุตำแหน่งคลังสินค้า สร้าง QR Code ติดตามชั้นวางเพื่อตรวจเช็คสต๊อกด่วนผ่านกล้องสมาร์ทโฟนของท่าน' 
              : 'สร้างและตั้งค่ารูปแบบสติกเกอร์ QR Code สำหรับสินค้าแต่ละชิ้น เพื่อติดลงบนแพ็คเกจ คัดแยก และสแกนเพื่อตัดเบิกสต๊อกได้ทันที'}
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'SHELVES' ? (
            <>
              <button
                onClick={() => setIsBatchPrintOpen(true)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 bg-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>พิมพ์บาร์โค้ดทุกชั้นวาง ({shelves.length})</span>
              </button>
              
              {canManageProducts && (
                <button
                  onClick={() => {
                    setEditingShelf(null);
                    setFormData({ name: '', description: '', zone: 'โซน A' });
                    setShowCustomZoneInput(false);
                    setIsFormOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มตำแหน่งชั้นวาง</span>
                </button>
              )}
            </>
          ) : (
            printQueue.length > 0 && (
              <button
                onClick={handlePrintQueue}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>สั่งพิมพ์คิวปัจจุบัน ({printQueue.reduce((sum, item) => sum + item.quantity, 0)} ใบ)</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-2xs">
        <button
          onClick={() => {
            setActiveTab('SHELVES');
            setError('');
            setSuccess('');
          }}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'SHELVES'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <MapPin className="w-4.5 h-4.5" />
          <span>ผังตำแหน่งชั้นวางสินค้า ({shelves.length})</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('PRODUCT_QR');
            setError('');
            setSuccess('');
          }}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'PRODUCT_QR'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <QrCode className="w-4.5 h-4.5" />
          <span>เครื่องมือสร้างและพิมพ์ป้าย QR สินค้ารายชิ้น ({products.length} รายการ)</span>
        </button>
      </div>

      {/* Success/Error Toast alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-600 text-sm font-bold">×</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-emerald-400 hover:text-emerald-600 text-sm font-bold">×</button>
        </div>
      )}

      {/* Conditional tab renders */}
      {activeTab === 'SHELVES' ? (
        <>
          {/* Search & Filter section */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อชั้นวาง, คำอธิบาย หรือ โซนสินค้า..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-400 font-bold shrink-0">โซนคลัง:</span>
              <div className="flex flex-wrap gap-1.5">
                {zones.map((zone) => (
                  <div
                    key={zone}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      selectedZone === zone
                        ? 'bg-blue-600 border-blue-600 text-white shadow-3xs'
                        : 'bg-slate-100 border-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedZone(zone)}
                      className="cursor-pointer font-semibold outline-hidden"
                    >
                      {zone === 'ALL' ? 'ทั้งหมด' : zone}
                    </button>
                    {zone !== 'ALL' && canManageProducts && (
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRenameZone(zone);
                          }}
                          className={`p-0.5 rounded transition-colors cursor-pointer ${
                            selectedZone === zone
                              ? 'text-blue-200 hover:text-white hover:bg-blue-700'
                              : 'text-slate-400 hover:text-blue-600 hover:bg-blue-100'
                          }`}
                          title={`แก้ไขชื่อโซน "${zone}"`}
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone);
                          }}
                          className={`p-0.5 rounded transition-colors cursor-pointer ${
                            selectedZone === zone
                              ? 'text-blue-200 hover:text-white hover:bg-blue-700'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-100'
                          }`}
                          title={`ลบโซน "${zone}" และชั้นวางที่ว่างอยู่ทั้งหมด`}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shelves Layout Cards Grid */}
          {filteredShelves.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-xs">
              <Map className="w-12 h-12 text-slate-300 mb-2" />
              <h5 className="font-bold text-slate-700 text-sm">ไม่พบตำแหน่งชั้นวางสินค้าที่ตรงเงื่อนไข</h5>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                ท่านสามารถกดปุ่ม "เพิ่มตำแหน่งชั้นวาง" มุมขวาบน เพื่อสร้างพิกัดจัดเก็บสินค้าได้ทันที
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredShelves.map((shelf) => {
                const shelfProducts = getProductsForShelf(shelf.name);
                const totalQty = shelfProducts.reduce((sum, p) => sum + p.quantity, 0);

                return (
                  <div 
                    key={shelf.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-all duration-200 flex flex-col justify-between hover:shadow-md group relative overflow-hidden"
                  >
                    {/* Decorative Zone Ribbon */}
                    <div className="absolute top-0 right-0 bg-slate-100 group-hover:bg-blue-50 text-[10px] font-bold text-slate-600 group-hover:text-blue-600 px-3 py-1 rounded-bl-lg border-l border-b border-slate-200 group-hover:border-blue-200 font-mono">
                      {shelf.zone || 'โซนทั่วไป'}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">พิกัดคลังเก็บ</span>
                      <h3 className="font-black text-slate-900 text-lg mt-0.5 group-hover:text-blue-600 transition-colors">
                        {shelf.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 h-8 leading-relaxed">
                        {shelf.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                      </p>

                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag className="w-4 h-4 text-slate-400" />
                          <div>
                            <span className="font-bold text-slate-800 text-xs block leading-none">{shelfProducts.length} รายการ</span>
                            <span className="text-[9px] text-slate-500">รวมทั้งหมด: {totalQty} ชิ้น</span>
                          </div>
                        </div>

                        <div 
                          onClick={() => setSelectedShelfForView(shelf)}
                          className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>ดูสินค้าในชั้น</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <div className="flex gap-1">
                        {canManageProducts && (
                          <>
                            <button
                              onClick={() => handleEditClick(shelf)}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="แก้ไขตำแหน่ง"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteShelf(shelf.id, shelf.name)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="ลบตำแหน่ง"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setPrintModalShelf(shelf)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>ดูป้ายติดชั้น / QR</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* PRODUCT_QR LABELS TAB */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left customize section: Col-span-7 */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-blue-600 rounded-full inline-block" />
                  <span>1. เลือกสินค้าและตกแต่งเนื้อหาบนป้ายสติกเกอร์</span>
                </h3>
              </div>

              {/* Autocomplete Product Selector */}
              <div className="relative">
                <label className="block text-xs font-black text-slate-700 mb-1.5">ค้นหาและระบุสินค้าที่ต้องการ:</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium font-mono"
                    placeholder="พิมพ์ชื่อสินค้า หรือ รหัส SKU ค้นหา..."
                    value={prodSearchQuery}
                    onChange={(e) => {
                      setProdSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                  />
                  {selectedProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setProdSearchQuery('');
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown Options */}
                {isDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {products.filter(p => 
                      p.name.toLowerCase().includes(prodSearchQuery.toLowerCase()) || 
                      p.sku.toLowerCase().includes(prodSearchQuery.toLowerCase())
                    ).length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">ไม่พบข้อมูลสินค้าที่ตรงกับการค้นหา</div>
                    ) : (
                      products
                        .filter(p => 
                          p.name.toLowerCase().includes(prodSearchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(prodSearchQuery.toLowerCase())
                        )
                        .map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProduct(p);
                              setProdSearchQuery(`${p.sku} - ${p.name}`);
                              setIsDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs border-b border-slate-50 flex justify-between items-center transition-colors cursor-pointer"
                          >
                            <div>
                              <div className="font-extrabold text-slate-800">{p.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {p.sku} | โซน: {p.location || 'ไม่ได้ระบุ'}</div>
                            </div>
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm font-bold text-[10px]">
                              {p.quantity} {p.unit}
                            </span>
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* Fast selector suggestions */}
              {!selectedProduct && products.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">หรือเลือกรายการสินค้าด่วน:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {products.slice(0, 5).map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProduct(p);
                          setProdSearchQuery(`${p.sku} - ${p.name}`);
                        }}
                        className="bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct && (
                <>
                  {/* Switch Display Option Checkboxes */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 space-y-3.5">
                    <span className="text-xs font-black text-slate-700 block">ตั้งค่าข้อมูลที่แสดงบนป้ายสติกเกอร์:</span>
                    <div className="grid grid-cols-2 gap-3.5">
                      <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showName}
                          onChange={(e) => setShowName(e.target.checked)}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>แสดงชื่อสินค้า</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSku}
                          onChange={(e) => setShowSku(e.target.checked)}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>แสดงรหัส SKU</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showLocation}
                          onChange={(e) => setShowLocation(e.target.checked)}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>แสดงพิกัดที่จัดเก็บ</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showUnit}
                          onChange={(e) => setShowUnit(e.target.checked)}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>แสดงหน่วยนับ</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-600 mb-1">ระบุคำเตือนพิเศษหรือข้อความกำกับ (ระบุได้ตามต้องการ):</label>
                      <input
                        type="text"
                        placeholder="เช่น เก็บในตู้เย็น, เบิกแล้วแจ้งผู้จัดการ, สินค้าแตกง่าย..."
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* QR Scan Action Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-700">พฤติกรรมเมื่อใช้กล้องมือถือสแกนคิวอาร์โค้ดนี้:</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <button
                        onClick={() => setQrAction('OUT')}
                        className={`p-3 rounded-lg text-xs font-bold text-center border cursor-pointer transition-all ${
                          qrAction === 'OUT'
                            ? 'bg-rose-50 border-rose-500 text-rose-700 font-black'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-rose-600 font-black text-sm">ตัดเบิกสินค้า (OUT)</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">สแกนเพื่อตัดยอดออกจากคลัง</div>
                      </button>

                      <button
                        onClick={() => setQrAction('IN')}
                        className={`p-3 rounded-lg text-xs font-bold text-center border cursor-pointer transition-all ${
                          qrAction === 'IN'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-black'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-emerald-600 font-black text-sm">รับสต๊อกสินค้า (IN)</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">สแกนเพื่อเพิ่มจำนวนสินค้า</div>
                      </button>

                      <button
                        onClick={() => setQrAction('VIEW')}
                        className={`p-3 rounded-lg text-xs font-bold text-center border cursor-pointer transition-all ${
                          qrAction === 'VIEW'
                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-black'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-blue-600 font-black text-sm">ตรวจสอบสินค้า (VIEW)</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">ตรวจสอบรายละเอียดทั่วไป</div>
                      </button>
                    </div>
                  </div>

                  {/* Size and Quantities */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1">ขนาดดวงสติกเกอร์:</label>
                      <select
                        value={stickerSize}
                        onChange={(e) => setStickerSize(e.target.value as 'SM' | 'MD' | 'LG' | 'CUSTOM')}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-semibold"
                      >
                        <option value="SM">ขนาดเล็ก (Small - 60x60 มม.)</option>
                        <option value="MD">ขนาดกลาง (Medium - 80x80 มม.)</option>
                        <option value="LG">ขนาดใหญ่ (Large - 100x100 มม.)</option>
                        <option value="CUSTOM">กำหนดขนาดเอง (Custom Size...)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 mb-1">จำนวนป้ายสติกเกอร์ที่ต้องการพิมพ์:</label>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => setLabelQty(prev => Math.max(1, prev - 1))}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-l-lg text-xs font-extrabold cursor-pointer h-[34px]"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={labelQty}
                          onChange={(e) => setLabelQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full text-center px-2 py-2 bg-white border-y border-slate-200 text-xs font-extrabold focus:outline-hidden h-[34px]"
                        />
                        <button
                          type="button"
                          onClick={() => setLabelQty(prev => prev + 1)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-r-lg text-xs font-extrabold cursor-pointer h-[34px]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Sizing Panel */}
                  {stickerSize === 'CUSTOM' && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3.5 animate-fade-in text-slate-700">
                      <div className="text-xs font-extrabold text-blue-900 flex items-center gap-1">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>ตั้งค่าขนาดพิกเซลบาร์โค้ดสติกเกอร์ (Custom Dimension Control)</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold">ความกว้างป้าย:</span>
                            <span className="text-[10px] font-extrabold text-blue-600 font-mono">{customCardWidth}px</span>
                          </div>
                          <input
                            type="range"
                            min="140"
                            max="450"
                            step="5"
                            value={customCardWidth}
                            onChange={(e) => {
                              const cw = Number(e.target.value);
                              setCustomCardWidth(cw);
                              // Keep QR size within boundary
                              if (customQrSize > cw - 20) {
                                setCustomQrSize(cw - 20);
                              }
                            }}
                            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold">ขนาด QR Code:</span>
                            <span className="text-[10px] font-extrabold text-blue-600 font-mono">{customQrSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="40"
                            max={customCardWidth - 20}
                            step="5"
                            value={customQrSize}
                            onChange={(e) => setCustomQrSize(Number(e.target.value))}
                            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold">ขนาดตัวอักษร:</span>
                            <span className="text-[10px] font-extrabold text-blue-600 font-mono">{customFontSize}px</span>
                          </div>
                          <input
                            type="range"
                            min="8"
                            max="24"
                            step="1"
                            value={customFontSize}
                            onChange={(e) => setCustomFontSize(Number(e.target.value))}
                            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold">ระยะขอบการ์ด:</span>
                            <span className="text-[10px] font-extrabold text-blue-600 font-mono">{customPadding}px</span>
                          </div>
                          <input
                            type="range"
                            min="4"
                            max="40"
                            step="1"
                            value={customPadding}
                            onChange={(e) => setCustomPadding(Number(e.target.value))}
                            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleAddToQueue}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มป้ายของสินค้านี้เข้าสู่คิวพิมพ์ ({labelQty} ป้าย)</span>
                  </button>
                </>
              )}
            </div>

            {/* Right real-time preview section: Col-span-5 */}
            <div className="lg:col-span-5 bg-slate-100 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center space-y-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block self-start">ตัวอย่างป้ายแบบไลฟ์สไตล์ (Real-time Live Preview):</span>
              
              {selectedProduct ? (
                <div 
                  className={`bg-white border-2 border-dashed border-slate-400 rounded-lg shadow-lg flex flex-col justify-between text-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] transition-all duration-300 ${
                    stickerSize === 'SM' ? 'w-56 p-4' : stickerSize === 'LG' ? 'w-80 p-6' : stickerSize === 'CUSTOM' ? '' : 'w-64 p-5'
                  }`}
                  style={stickerSize === 'CUSTOM' ? {
                    width: `${customCardWidth}px`,
                    padding: `${customPadding}px`,
                    fontSize: `${customFontSize}px`
                  } : undefined}
                >
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">
                    {selectedProduct.category || 'หมวดทั่วไป'}
                  </div>
                  
                  {showName && (
                    <div 
                      className="font-extrabold text-slate-900 mt-1 line-clamp-2 leading-snug"
                      style={stickerSize === 'CUSTOM' ? { fontSize: `${customFontSize}px` } : { fontSize: '12px' }}
                    >
                      {selectedProduct.name}
                    </div>
                  )}

                  <div className="my-4 bg-white p-1 rounded-lg border border-slate-100 shadow-3xs inline-block mx-auto">
                    <img 
                      src={getQrCodeUrlForProduct(selectedProduct, qrAction)} 
                      alt="Product QR Preview" 
                      className="transition-all duration-300"
                      style={stickerSize === 'CUSTOM' ? {
                        width: `${customQrSize}px`,
                        height: `${customQrSize}px`
                      } : {
                        width: stickerSize === 'SM' ? '90px' : stickerSize === 'LG' ? '170px' : '130px',
                        height: stickerSize === 'SM' ? '90px' : stickerSize === 'LG' ? '170px' : '130px'
                      }}
                    />
                  </div>

                  <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold text-white mx-auto ${
                    qrAction === 'OUT' ? 'bg-rose-500' : qrAction === 'IN' ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}>
                    {qrAction === 'OUT' ? 'สแกนเพื่อตัดเบิก (OUT)' : qrAction === 'IN' ? 'สแกนรับของเข้า (IN)' : 'สแกนตรวจสอบสต๊อก'}
                  </div>

                  <div 
                    className="text-left mt-3.5 pt-3.5 border-t border-dashed border-slate-200 text-slate-600 space-y-0.5"
                    style={stickerSize === 'CUSTOM' ? { fontSize: `${customFontSize - 1}px` } : { fontSize: '11px' }}
                  >
                    {showSku && <div><strong>SKU:</strong> {selectedProduct.sku}</div>}
                    {showLocation && <div><strong>พิกัดคลัง:</strong> {selectedProduct.location || 'ไม่ได้ระบุ'}</div>}
                    {showUnit && <div><strong>หน่วยเบิก:</strong> {selectedProduct.unit}</div>}
                    {customText && (
                      <div className="text-orange-600 font-bold mt-1 bg-orange-50 p-1 border border-orange-100 rounded text-[10px]">
                        ⚠️ {customText}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <QrCode className="w-16 h-16 mx-auto mb-2 opacity-30 animate-pulse" />
                  <p className="text-xs font-bold text-slate-500">กรุณาเลือกสินค้าก่อนเพื่อดูตัวอย่างป้ายสติกเกอร์</p>
                </div>
              )}

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                * เส้นขอบประเป็นแนวตัดสติกเกอร์จำลอง ป้ายจริงจะพิมพ์แยกเป็นชิ้น ๆ พร้อมจัดเรียงแผงให้อย่างสวยงามครับ
              </p>
            </div>
          </div>

          {/* PRINT QUEUE STORAGE LIST */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-emerald-600 rounded-full inline-block" />
                  <span>2. รายการคิวพิมพ์สติกเกอร์ทั้งหมด ({printQueue.length} สินค้า)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">รวมจำนวนแผ่นสติกเกอร์ที่พิมพ์: {printQueue.reduce((sum, item) => sum + item.quantity, 0)} แผ่น</p>
              </div>

              {printQueue.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm('ล้างคิวพิมพ์ป้ายสติกเกอร์ทั้งหมดใช่หรือไม่?')) {
                        setPrintQueue([]);
                      }
                    }}
                    className="px-3 py-1.5 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                  >
                    ล้างคิวทั้งหมด
                  </button>
                  <button
                    onClick={handlePrintQueue}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>สั่งพิมพ์ป้ายสติกเกอร์ทั้งหมด</span>
                  </button>
                </div>
              )}
            </div>

            {printQueue.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-100 rounded-xl text-center text-slate-400">
                <Printer className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                <p className="text-xs font-bold text-slate-500">คิวพิมพ์ว่างเปล่าในขณะนี้</p>
                <p className="text-[10px] text-slate-400 mt-1">กรุณาเลือกสินค้าด้านบนแล้วกด "เพิ่มป้ายของสินค้านี้เข้าสู่คิวพิมพ์"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {printQueue.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center hover:bg-white transition-all"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-extrabold text-slate-800 line-clamp-1">{item.product.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        SKU: {item.product.sku} | พิกัด: {item.product.location || 'ไม่มี'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black text-white ${
                          item.qrAction === 'OUT' ? 'bg-rose-500' : item.qrAction === 'IN' ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}>
                          {item.qrAction === 'OUT' ? 'OUT' : item.qrAction === 'IN' ? 'IN' : 'VIEW'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                          {item.stickerSize === 'SM' ? 'ขนาดเล็ก' : 
                           item.stickerSize === 'LG' ? 'ขนาดใหญ่' : 
                           item.stickerSize === 'CUSTOM' ? `กำหนดเอง (${item.customCardWidth}px)` : 'ขนาดกลาง'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setPrintQueue(prev => prev.filter(q => q.id !== item.id));
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5">
                        <button
                          onClick={() => {
                            setPrintQueue(prev => prev.map(q => q.id === item.id ? { ...q, quantity: Math.max(1, q.quantity - 1) } : q));
                          }}
                          className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-1.5 text-xs font-extrabold font-mono text-slate-800">{item.quantity}</span>
                        <button
                          onClick={() => {
                            setPrintQueue(prev => prev.map(q => q.id === item.id ? { ...q, quantity: q.quantity + 1 } : q));
                          }}
                          className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: Add/Edit Shelf --- */}
      {isFormOpen && (
        <div 
          onClick={() => setIsFormOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up"
          >
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between">
              <h4 className="font-extrabold text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>{editingShelf ? 'แก้ไขตำแหน่งชั้นวางสินค้า' : 'เพิ่มพิกัดชั้นวางสินค้าใหม่'}</span>
              </h4>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                  ชื่อ / รหัสตู้ หรือชั้นจัดเก็บ *
                </label>
                <input
                  type="text"
                  placeholder="เช่น A1, Shelf-B2, โซนตู้แช่หลัก"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-slate-50 focus:bg-white"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  * ชื่อนี้จะต้องไปใช้จับคู่ตรงกับช่อง "พิกัดจัดเก็บ (Location)" ของสินค้าในระบบคลัง
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                  โซนหลัก (Zone) *
                </label>
                <select
                  value={showCustomZoneInput ? 'CUSTOM' : formData.zone}
                  onChange={(e) => {
                    if (e.target.value === 'CUSTOM') {
                      setShowCustomZoneInput(true);
                      setFormData(prev => ({ ...prev, zone: '' }));
                    } else {
                      setShowCustomZoneInput(false);
                      setFormData(prev => ({ ...prev, zone: e.target.value }));
                    }
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-slate-50 focus:bg-white font-medium"
                >
                  {allAvailableZones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                  <option value="CUSTOM">+ ระบุชื่อโซนอื่นด้วยตัวเอง...</option>
                </select>

                {showCustomZoneInput && (
                  <div className="mt-2 animate-fade-in">
                    <label className="block text-[10px] font-bold text-blue-600 mb-1">
                      ระบุชื่อโซนใหม่เอง *
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น โซนเก็บอาหาร, ห้องเตรียมส่ง, ตู้แช่เย็น"
                      value={formData.zone}
                      onChange={(e) => setFormData(prev => ({ ...prev, zone: e.target.value }))}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-blue-50/30 focus:bg-white font-semibold"
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                  คำอธิบายหรือข้อมูลเพิ่มเติม
                </label>
                <textarea
                  rows={3}
                  placeholder="เช่น ชั้นสำหรับวางอาหารเสริมแบรนด์พรีเมียม ถัดจากเสากลาง..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingShelf ? 'บันทึกการแก้ไข' : 'สร้างตำแหน่งจัดเก็บ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: View Shelf Items & Quick Audit --- */}
      {selectedShelfForView && (
        <div 
          onClick={() => {
            setSelectedShelfForView(null);
            setIsAssignDropdownOpen(false);
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up"
          >
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                  <span>รายการสินค้าคงเหลือในชั้นวาง "{selectedShelfForView.name}"</span>
                </h4>
                <p className="text-[10px] text-slate-400">{selectedShelfForView.description || 'ชั้นวางจัดสรรของคลังสินค้าหลัก'}</p>
              </div>
              <button 
                onClick={() => setSelectedShelfForView(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Add Product to Shelf Assignment UI */}
              {canManageProducts && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <Plus className="w-4.5 h-4.5 text-blue-600 bg-blue-100 p-0.5 rounded-full" />
                    <span>ระบุรายการสินค้าเข้ามาจัดเก็บบนชั้นวาง "{selectedShelfForView.name}"</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 relative">
                    {/* Autocomplete Selector */}
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-medium"
                        placeholder="พิมพ์เพื่อค้นหาตามชื่อสินค้า หรือ SKU..."
                        value={assignSearchQuery}
                        onChange={(e) => {
                          setAssignSearchQuery(e.target.value);
                          setIsAssignDropdownOpen(true);
                        }}
                        onFocus={() => setIsAssignDropdownOpen(true)}
                      />
                      {selectedProductIdToAssign && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductIdToAssign('');
                            setAssignSearchQuery('');
                          }}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}

                      {/* Dropdown list of candidate products */}
                      {isAssignDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {products.filter(p => {
                            const isAlreadyHere = (p.location || '').trim().toLowerCase() === selectedShelfForView.name.trim().toLowerCase();
                            const matchesQuery = p.name.toLowerCase().includes(assignSearchQuery.toLowerCase()) || p.sku.toLowerCase().includes(assignSearchQuery.toLowerCase());
                            return !isAlreadyHere && matchesQuery;
                          }).length === 0 ? (
                            <div className="p-3 text-[11px] text-slate-400 text-center">ไม่พบรายการสินค้าที่ตรงเงื่อนไข</div>
                          ) : (
                            products
                              .filter(p => {
                                const isAlreadyHere = (p.location || '').trim().toLowerCase() === selectedShelfForView.name.trim().toLowerCase();
                                const matchesQuery = p.name.toLowerCase().includes(assignSearchQuery.toLowerCase()) || p.sku.toLowerCase().includes(assignSearchQuery.toLowerCase());
                                return !isAlreadyHere && matchesQuery;
                              })
                              .map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProductIdToAssign(p.id);
                                    setAssignSearchQuery(`${p.sku} - ${p.name}`);
                                    setIsAssignDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-[11px] border-b border-slate-50 flex justify-between items-center transition-colors cursor-pointer"
                                >
                                  <div>
                                    <div className="font-extrabold text-slate-800">{p.name}</div>
                                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                      SKU: {p.sku} {p.location ? `| อยู่ที่: ${p.location}` : '| ยังไม่มีพิกัดจัดเก็บ'}
                                    </div>
                                  </div>
                                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-black text-[9px] shrink-0">
                                    เลือก
                                  </span>
                                </button>
                              ))
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!selectedProductIdToAssign}
                      onClick={() => handleAssignProductToShelf(selectedProductIdToAssign, selectedShelfForView.name)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black shrink-0 transition-colors cursor-pointer"
                    >
                      ย้ายเข้าชั้นวางนี้
                    </button>
                  </div>
                </div>
              )}

              {getProductsForShelf(selectedShelfForView.name).length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <span className="text-xs font-bold block text-slate-700">ไม่มีสินค้าค้างอยู่ในชั้นวางนี้</span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    คุณสามารถค้นหาและเลือกสินค้าที่ต้องการด้านบนเพื่อจัดตำแหน่งพิกัดจัดเก็บเข้ามาในชั้นวาง "{selectedShelfForView.name}" ได้เลยครับ
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-3">รูปภาพ / ข้อมูลสินค้า</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">หมวดหมู่</th>
                        <th className="py-2.5 px-3 text-right">จำนวนคงเหลือ</th>
                        {canManageProducts && <th className="py-2.5 px-3 text-center">จัดการ</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getProductsForShelf(selectedShelfForView.name).map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 text-xs block">{prod.name}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                              {prod.sku}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{prod.category}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={prod.quantity <= prod.minStock ? 'text-amber-600' : 'text-slate-800'}>
                              {prod.quantity} {prod.unit}
                            </span>
                            {prod.quantity <= prod.minStock && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded-sm ml-1">
                                สต๊อกต่ำ
                              </span>
                            )}
                          </td>
                          {canManageProducts && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleRemoveProductFromShelf(prod.id, prod.name)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1.5 font-bold"
                                title="ย้ายออกจากชั้นวางนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="text-[10px]">ย้ายออก</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedShelfForView(null)}
                className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold cursor-pointer shadow-sm transition-colors"
              >
                ปิดหน้ารายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Single Print Card Preview --- */}
      {printModalShelf && (
        <div 
          onClick={() => setPrintModalShelf(null)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up"
          >
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-blue-400" />
                <span>พรีวิวป้ายชั้นวาง QR Code</span>
              </h4>
              <button 
                onClick={() => setPrintModalShelf(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center bg-slate-50 space-y-5 w-full">
              {/* Size Configuration Controls */}
              <div className="w-full bg-white border border-slate-200/80 rounded-xl p-4 space-y-3 shadow-xs">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1 flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                    <span>ปรับแต่งขนาดป้ายชั้นวาง (Shelf Tag Sizing):</span>
                  </label>
                  <select
                    value={shelfStickerSize}
                    onChange={(e) => setShelfStickerSize(e.target.value as 'SM' | 'MD' | 'LG' | 'CUSTOM')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-semibold text-slate-700"
                  >
                    <option value="SM">ขนาดเล็ก (Small - 60x60 มม.)</option>
                    <option value="MD">ขนาดกลาง (Medium - 80x80 มม.)</option>
                    <option value="LG">ขนาดใหญ่ (Large - 100x100 มม.)</option>
                    <option value="CUSTOM">กำหนดขนาดเอง (Custom Size...)</option>
                  </select>
                </div>

                {shelfStickerSize === 'CUSTOM' && (
                  <div className="space-y-3 pt-2.5 border-t border-slate-200/50">
                    <div className="grid grid-cols-2 gap-3 text-slate-700">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold">ความกว้างป้าย:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 font-mono">{shelfCustomCardWidth}px</span>
                        </div>
                        <input
                          type="range"
                          min="200"
                          max="450"
                          step="5"
                          value={shelfCustomCardWidth}
                          onChange={(e) => {
                            const cw = Number(e.target.value);
                            setShelfCustomCardWidth(cw);
                            if (shelfCustomQrSize > cw - 40) {
                              setShelfCustomQrSize(cw - 40);
                            }
                          }}
                          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold">ขนาด QR Code:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 font-mono">{shelfCustomQrSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="80"
                          max={shelfCustomCardWidth - 40}
                          step="5"
                          value={shelfCustomQrSize}
                          onChange={(e) => setShelfCustomQrSize(Number(e.target.value))}
                          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold">ขนาดอักษร:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 font-mono">{shelfCustomFontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="24"
                          step="1"
                          value={shelfCustomFontSize}
                          onChange={(e) => setShelfCustomFontSize(Number(e.target.value))}
                          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold">ระยะขอบการ์ด:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 font-mono">{shelfCustomPadding}px</span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="48"
                          step="1"
                          value={shelfCustomPadding}
                          onChange={(e) => setShelfCustomPadding(Number(e.target.value))}
                          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Printable Area */}
              <div id="printable-area" className="w-full flex justify-center">
                <div 
                  className="print-card w-full border-4 border-slate-950 rounded-2xl bg-white text-center shadow-xs transition-all duration-300 flex flex-col justify-between"
                  style={{
                    padding: `${shelfStickerSize === 'CUSTOM' ? shelfCustomPadding : shelfStickerSize === 'SM' ? 16 : shelfStickerSize === 'LG' ? 32 : 24}px`,
                    maxWidth: `min(100%, ${shelfStickerSize === 'CUSTOM' ? shelfCustomCardWidth : shelfStickerSize === 'SM' ? 260 : shelfStickerSize === 'LG' ? 420 : 340}px)`,
                  }}
                >
                  <div>
                    <div className="text-[11px] text-slate-400 font-extrabold tracking-widest uppercase mb-1">
                      {printModalShelf.zone || 'คลังสินค้าหลัก'}
                    </div>
                    <h3 
                      className="title font-black text-slate-950 tracking-tight m-0 uppercase"
                      style={{
                        fontSize: `${(shelfStickerSize === 'CUSTOM' ? shelfCustomFontSize : shelfStickerSize === 'SM' ? 11 : shelfStickerSize === 'LG' ? 17 : 14) + 14}px`
                      }}
                    >
                      {printModalShelf.name}
                    </h3>
                    <div 
                      className="subtitle text-slate-500 font-bold uppercase tracking-wider mb-4"
                      style={{
                        fontSize: `${(shelfStickerSize === 'CUSTOM' ? shelfCustomFontSize : shelfStickerSize === 'SM' ? 11 : shelfStickerSize === 'LG' ? 17 : 14) - 2}px`
                      }}
                    >
                      STORAGE SHELF QR CODE
                    </div>
                  </div>
                  
                  <img
                    src={getQrCodeUrlForShelf(printModalShelf)}
                    alt={`QR Code shelf ${printModalShelf.name}`}
                    className="qr-image mx-auto my-3 border border-slate-200 p-2 bg-white rounded-lg shadow-2xs transition-all duration-300 max-w-full h-auto"
                    style={{
                      width: `${shelfStickerSize === 'CUSTOM' ? shelfCustomQrSize : shelfStickerSize === 'SM' ? 120 : shelfStickerSize === 'LG' ? 240 : 180}px`,
                      height: `${shelfStickerSize === 'CUSTOM' ? shelfCustomQrSize : shelfStickerSize === 'SM' ? 120 : shelfStickerSize === 'LG' ? 240 : 180}px`,
                    }}
                    referrerPolicy="no-referrer"
                  />
                  
                  <div>
                    <p 
                      className="description text-slate-700 border-t border-dashed border-slate-200 pt-3 mt-3 leading-relaxed"
                      style={{
                        fontSize: `${(shelfStickerSize === 'CUSTOM' ? shelfCustomFontSize : shelfStickerSize === 'SM' ? 11 : shelfStickerSize === 'LG' ? 17 : 14) - 1}px`
                      }}
                    >
                      <strong>คำอธิบาย:</strong> {printModalShelf.description || 'ไม่มีคำอธิบายเสริม'}<br/>
                      <span className="text-[10px] text-slate-400 block mt-1">ใช้แอปคลังสินค้า หรือสมาร์ทโฟนสแกนเพื่ออัปเดตสต๊อกทันที</span>
                    </p>
                    
                    <div 
                      className="footer-text text-slate-400 mt-2 font-mono"
                      style={{
                        fontSize: `${(shelfStickerSize === 'CUSTOM' ? shelfCustomFontSize : shelfStickerSize === 'SM' ? 11 : shelfStickerSize === 'LG' ? 17 : 14) - 4}px`
                      }}
                    >
                      ID: {printModalShelf.id}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions panel */}
            <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-2 shrink-0 w-full">
              <button
                onClick={() => setPrintModalShelf(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={triggerPrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>ดาวน์โหลด / พิมพ์บาร์โค้ด</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Batch Print Cards Preview --- */}
      {isBatchPrintOpen && (
        <div 
          onClick={() => setIsBatchPrintOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up"
          >
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-blue-400" />
                <span>พรีวิวและปรับแต่งการพิมพ์ป้ายชั้นวางทั้งหมด ({shelves.length} รายการ)</span>
              </h4>
              <button 
                onClick={() => setIsBatchPrintOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50 flex-1">
              {/* Batch Configuration Panel */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4 max-w-3xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1 flex items-center gap-1">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                      <span>ปรับขนาดป้ายกลุ่มนี้ (Batch Tag Sizing):</span>
                    </label>
                    <select
                      value={shelfStickerSize}
                      onChange={(e) => setShelfStickerSize(e.target.value as 'SM' | 'MD' | 'LG' | 'CUSTOM')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-semibold text-slate-700"
                    >
                      <option value="SM">ขนาดเล็ก (Small - 60x60 มม.)</option>
                      <option value="MD">ขนาดกลาง (Medium - 80x80 มม.)</option>
                      <option value="LG">ขนาดใหญ่ (Large - 100x100 มม.)</option>
                      <option value="CUSTOM">กำหนดขนาดเอง (Custom Size...)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1 flex items-center gap-1">
                      <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                      <span>จำนวนคอลัมน์แสดงผลตอนพิมพ์ (Grid Columns):</span>
                    </label>
                    <select
                      value={shelfGridColumns}
                      onChange={(e) => setShelfGridColumns(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-semibold text-slate-700"
                    >
                      <option value={1}>1 คอลัมน์ (เดี่ยว - เหมาะสำหรับป้ายขนาดใหญ่)</option>
                      <option value={2}>2 คอลัมน์ (มาตรฐานสมดุล)</option>
                      <option value={3}>3 คอลัมน์ (เหมาะสำหรับป้ายขนาดเล็กและกลาง)</option>
                    </select>
                  </div>
                </div>

                {shelfStickerSize === 'CUSTOM' && (
                  <div className="space-y-3 pt-3 border-t border-slate-200/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-700">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold">ความกว้างป้าย:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 font-mono">{shelfCustomCardWidth}px</span>
                        </div>
                        <input
                          type="range"
                          min="180"
                          max="450"
                          step="5"
                          value={shelfCustomCardWidth}
                          onChange={(e) => {
                            const cw = Number(e.target.value);
                            setShelfCustomCardWidth(cw);
                            if (shelfCustomQrSize > cw - 40) {
                              setShelfCustomQrSize(cw - 40);
                            }
                          }}
                          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold">ขนาด QR Code:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 font-mono">{shelfCustomQrSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="60"
                          max={shelfCustomCardWidth - 40}
                          step="5"
                          value={shelfCustomQrSize}
                          onChange={(e) => setShelfCustomQrSize(Number(e.target.value))}
                          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold">ขนาดอักษร:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 font-mono">{shelfCustomFontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="24"
                          step="1"
                          value={shelfCustomFontSize}
                          onChange={(e) => setShelfCustomFontSize(Number(e.target.value))}
                          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold">ระยะขอบการ์ด:</span>
                          <span className="text-[10px] font-extrabold text-blue-600 font-mono">{shelfCustomPadding}px</span>
                        </div>
                        <input
                          type="range"
                          min="6"
                          max="48"
                          step="1"
                          value={shelfCustomPadding}
                          onChange={(e) => setShelfCustomPadding(Number(e.target.value))}
                          className="w-full accent-blue-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Printable batch container preview */}
              <div 
                id="printable-area-batch" 
                className="grid gap-4 justify-center w-full"
                style={{
                  gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 640
                    ? '1fr'
                    : `repeat(${shelfGridColumns}, minmax(0, 1fr))`
                }}
              >
                {shelves.map((shelf) => {
                  const cardWidth = shelfStickerSize === 'CUSTOM' ? shelfCustomCardWidth : shelfStickerSize === 'SM' ? 260 : shelfStickerSize === 'LG' ? 420 : 340;
                  const qrSize = shelfStickerSize === 'CUSTOM' ? shelfCustomQrSize : shelfStickerSize === 'SM' ? 120 : shelfStickerSize === 'LG' ? 240 : 180;
                  const fontSize = shelfStickerSize === 'CUSTOM' ? shelfCustomFontSize : shelfStickerSize === 'SM' ? 11 : shelfStickerSize === 'LG' ? 17 : 14;
                  const padding = shelfStickerSize === 'CUSTOM' ? shelfCustomPadding : shelfStickerSize === 'SM' ? 16 : shelfStickerSize === 'LG' ? 32 : 24;

                  return (
                    <div 
                      key={shelf.id} 
                      className="print-card border-4 border-slate-950 rounded-2xl bg-white text-center shadow-xs transition-all duration-300 flex flex-col justify-between"
                      style={{
                        padding: `${padding}px`,
                        maxWidth: `min(100%, ${cardWidth}px)`,
                        margin: '0 auto',
                        width: '100%'
                      }}
                    >
                      <div>
                        <div className="text-[10px] text-slate-400 font-extrabold uppercase mb-1 tracking-wider">
                          {shelf.zone || 'คลังสินค้าหลัก'}
                        </div>
                        <h3 
                          className="font-black text-slate-950 uppercase m-0 leading-tight"
                          style={{
                            fontSize: `${fontSize + 6}px`
                          }}
                        >
                          {shelf.name}
                        </h3>
                        <div 
                          className="text-slate-400 font-bold uppercase tracking-wider mb-2"
                          style={{
                            fontSize: `${fontSize - 4}px`
                          }}
                        >
                          STORAGE SHELF QR CODE
                        </div>
                      </div>

                      <img
                        src={getQrCodeUrlForShelf(shelf)}
                        alt={`QR Code shelf ${shelf.name}`}
                        className="mx-auto my-2 border border-slate-200 p-1 bg-white rounded-lg transition-all duration-300 max-w-full h-auto"
                        style={{
                          width: `${qrSize}px`,
                          height: `${qrSize}px`,
                        }}
                        referrerPolicy="no-referrer"
                      />

                      <div>
                        <p 
                          className="text-slate-600 line-clamp-2 leading-relaxed border-t border-dashed border-slate-100 pt-1.5 mt-1.5"
                          style={{
                            fontSize: `${fontSize - 1}px`
                          }}
                        >
                          {shelf.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                        </p>
                        <div 
                          className="text-slate-400 font-mono mt-1 leading-none"
                          style={{
                            fontSize: `${fontSize - 4}px`
                          }}
                        >
                          ID: {shelf.id}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsBatchPrintOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  const cardWidth = shelfStickerSize === 'CUSTOM' ? shelfCustomCardWidth : shelfStickerSize === 'SM' ? 260 : shelfStickerSize === 'LG' ? 420 : 340;
                  const qrSize = shelfStickerSize === 'CUSTOM' ? shelfCustomQrSize : shelfStickerSize === 'SM' ? 120 : shelfStickerSize === 'LG' ? 240 : 180;
                  const fontSize = shelfStickerSize === 'CUSTOM' ? shelfCustomFontSize : shelfStickerSize === 'SM' ? 11 : shelfStickerSize === 'LG' ? 17 : 14;
                  const padding = shelfStickerSize === 'CUSTOM' ? shelfCustomPadding : shelfStickerSize === 'SM' ? 16 : shelfStickerSize === 'LG' ? 32 : 24;
                  const cols = shelfGridColumns;

                  const fullHtml = `
                    <html>
                      <head>
                        <title>พิมพ์ป้ายชั้นวางสินค้า QR Code - แบบชุด</title>
                        <style>
                          body { 
                            font-family: Arial, sans-serif; 
                            margin: 0; 
                            padding: 20px; 
                            background: #fff;
                            text-align: center;
                          }
                          .batch-title {
                            font-size: 18px;
                            font-weight: bold;
                            margin-bottom: 20px;
                          }
                          .grid-container {
                            display: grid;
                            grid-template-columns: repeat(${cols}, 1fr);
                            gap: 20px;
                            max-width: ${cols * (cardWidth + 40)}px;
                            margin: 0 auto;
                          }
                          .print-card {
                            border: 3px solid #000;
                            border-radius: 12px;
                            padding: ${padding}px;
                            background: #fff;
                            box-shadow: none;
                            page-break-inside: avoid;
                            width: 100%;
                            max-width: ${cardWidth}px;
                            margin: 0 auto;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                          }
                          .title { 
                            font-size: ${fontSize + 6}px; 
                            font-weight: bold; 
                            margin: 0; 
                            color: #000;
                          }
                          .qr-image { 
                            width: ${qrSize}px; 
                            height: ${qrSize}px; 
                            margin: 10px auto;
                            display: block;
                          }
                          .description { 
                            font-size: ${fontSize - 1}px; 
                            color: #333; 
                            margin-top: 10px;
                            border-top: 1px dashed #ccc;
                            padding-top: 10px;
                          }
                          .footer-text {
                            font-size: ${fontSize - 4}px;
                            color: #888;
                            margin-top: 5px;
                          }
                          .btn-print-trigger {
                            background-color: #2563eb;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            font-size: 14px;
                            font-weight: bold;
                            border-radius: 6px;
                            cursor: pointer;
                            margin-bottom: 20px;
                          }
                          @media print {
                            .btn-print-trigger { display: none; }
                            body { padding: 0; }
                            .grid-container {
                              display: grid;
                              grid-template-columns: repeat(${cols}, 1fr);
                              gap: 20px;
                            }
                          }
                        </style>
                      </head>
                      <body>
                        <button class="btn-print-trigger" onclick="window.print()">กดปุ่มนี้เพื่อเริ่มพิมพ์ / บันทึก PDF</button>
                        <div class="batch-title btn-print-trigger">ใบปะชั้นวางสินค้าคงคลังระบบทั้งหมด (${shelves.length} ป้าย)</div>
                        <div class="grid-container">
                          ${shelves.map(shelf => {
                            const shelfTitle = shelf.name;
                            const shelfZone = shelf.zone || 'คลังสินค้าหลัก';
                            const shelfDesc = shelf.description || 'ไม่มีรายละเอียดเพิ่มเติม';
                            const qrUrl = getQrCodeUrlForShelf(shelf);
                            return `
                              <div class="print-card">
                                <div>
                                  <div style="font-size: ${fontSize - 4}px; color: #888; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">
                                    ${shelfZone}
                                  </div>
                                  <div class="title">${shelfTitle}</div>
                                  <div style="font-size: ${fontSize - 3}px; color: #555; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    STORAGE SHELF QR CODE
                                  </div>
                                </div>
                                <img class="qr-image" src="${qrUrl}" referrerPolicy="no-referrer" />
                                <div>
                                  <div class="description">${shelfDesc}</div>
                                  <div class="footer-text">ID: ${shelf.id}</div>
                                </div>
                              </div>
                            `;
                          }).join('')}
                        </div>
                      </body>
                    </html>
                  `;

                  printHtmlContent(fullHtml);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ป้ายกลุ่มนี้ ({shelves.length} ป้าย)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rename Zone */}
      {isZoneEditModalOpen && (
        <div 
          onClick={() => setIsZoneEditModalOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up"
          >
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between">
              <h4 className="font-extrabold text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <span>แก้ไขชื่อโซนหลัก</span>
              </h4>
              <button 
                onClick={() => setIsZoneEditModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  ชื่อโซนเดิม
                </label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 font-semibold">
                  {zoneToRename}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อโซนใหม่ *
                </label>
                <input
                  type="text"
                  placeholder="เช่น โซนหน้าร้าน, ห้องเก็บอาหาร"
                  value={renamedZoneName}
                  onChange={(e) => setRenamedZoneName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-slate-50 focus:bg-white font-semibold"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  * การเปลี่ยนชื่อโซนจะแก้ไขข้อมูลของชั้นวางทั้งหมดที่อยู่ในโซนนี้โดยอัตโนมัติ สินค้าที่อิงตำแหน่งชั้นวางในโซนนี้จะยังคงเชื่อมโยงอย่างถูกต้อง
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsZoneEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveZoneRename}
                  disabled={!renamedZoneName.trim() || renamedZoneName.trim() === zoneToRename}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        isAlertOnly={confirmDialog.isAlertOnly}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel || (() => setConfirmDialog(p => ({ ...p, isOpen: false })))}
      />
    </div>
  );
}
