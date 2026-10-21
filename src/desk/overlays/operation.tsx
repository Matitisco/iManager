import { DepositChoices, useClientDeposits, receiptMoney } from './deposits';
import { depositAmount, depositAvailable } from '../deposits';
import { toUserMessage } from '../../lib/user-message';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { INPUT_LIMITS } from '../../lib/input-limits';
import { parseDeviceCode } from '../../lib/device-scan';
import { IMEI_FORMAT_MESSAGE, IMEI_OPTIONAL_LABEL, imeiFormatError } from '../../lib/imei';
import { createWedgeBuffer, focusNextControl } from '../../lib/keyboard-wedge';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { voidedSale } from '../archive-cache';
import { RecordHistory } from '../screens/HistoryScreen';
import type { Client, OperationClientOption, OperationProductOption, Product, Sale } from '../../types';
import type { OperationInput, OperationSource } from '../../services/operations-api';
import { saleBuyer, equipmentTitle, isInStock, formatInputMoney, formatShortDate, parseMoney, paymentLabel, saleCode, saleEquipment, formatImei } from '../format';
import { cancellationPlan, displayedSaleDue, type RefundTarget } from '../cancel-refund';
import { fetchClientPayments, type ClientPaymentRecord } from '../../services/clients-api';
import { useMoney } from '../exchange';
import { FX_WARNING } from '../money';
import { CatalogEditor, catalogChoices, useCatalogs } from '../catalog';
import type { CatalogKind } from '../../services/catalogs-api';
import { SellerField } from '../SellerField';
import { ClientField } from '../ClientField';
import { EquipmentField } from '../EquipmentField';
import { MISSING_OUTGOING_PRICE, NEGATIVE_TRADE_DIFFERENCE, outgoingTradeDifference, reservedForOtherClient } from '../sale-equipment';
import { usePhoneLayout } from '../section-notices';
import { QualityField } from '../QualityField';
import { canonicalQuality, displayQuality, isUsedCondition, qualityDetail, tradeQuality } from '../quality';
import { confirmScan } from '../scan/beep';
import { CameraScanner } from '../scan/CameraScanner';
import { draftFromCode, draftFromImei } from '../scan/draft';
import { ScanCameraButton } from '../scan/ImeiScanField';
import { Field, Pill, Segs, Sheet, SheetActionMenu, SheetActions, useDesk } from '../ui';
import { clearBad, PAYMENTS, BASE_CONDITIONS, CJ_STATUS, stampedCurrency, ConfirmOperationDialog, AuditLine, shareOrCopy, type FormProps } from './shared';
import { ReportDatePicker } from '../report-date-picker';
import { arFromIso, defaultSaleWarrantyDays, DEFAULT_SEALED_WARRANTY_DAYS, DEFAULT_USED_WARRANTY_DAYS, isoFromAr, parseWarrantyDaysInput, saleWarrantyView, warrantyDueCopy } from '../../lib/warranty';
import { SalePaymentsFields, type SettlementState } from './sale-payments';
import { SaleAccountPanel } from '../screens/CurrentAccount';

export function SaleForm({ id, preset, run, busy, error }: FormProps & { id?: string; preset?: { clientName?: string; clientId?: string; productId?: string; source?: OperationSource; tradeInId?: string; resumeAmount?: string } }) {
  return <OperationForm saleId={id} tradeId={preset?.tradeInId} source={preset?.source ?? 'sales'} preset={preset} run={run} busy={busy} error={error} />;
}

export function operationMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return formatInputMoney(Number(digits)) || '0';
}

function productMoneyCurrency(item: { currency?: string | null } | null | undefined) {
  return item?.currency;
}

export function OperationForm({ saleId, tradeId, source, preset, startWithTrade = false, run, busy, error }: FormProps & {
  saleId?: string;
  tradeId?: string;
  source: OperationSource;
  preset?: { clientName?: string; clientId?: string; productId?: string; resumeAmount?: string };
  startWithTrade?: boolean;
}) {
  const context = useAppContext();
  const money = useMoney();
  const { sales = [], tradeIns = [], operationDrafts = [], clients = [], inventory = [], operationOptions = {}, loadOperationOptions, createOperation, updateSaleOperation, updateTradeOperation, confirmTradeOperation, fetchSaleOperation, fetchTradeOperation } = context;
  const catalogs = useCatalogs();
  const requestKey = useRef(`desk-${crypto.randomUUID()}`);
  const dirty = useRef(new Set<string>());
  const explicitSale = sales.find((sale) => sale.id === saleId);
  const tradeRef = explicitSale?.tradeInId ?? tradeId;
  const currentTrade = tradeIns.find((trade) => trade.id === tradeRef) ?? operationDrafts.find((trade) => trade.id === tradeRef);
  const currentSale = explicitSale ?? sales.find((sale) => sale.id === currentTrade?.saleId);
  const cancelled = currentSale?.status === 'CANCELADA';
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [error]);
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [hasTrade, setHasTrade] = useState(startWithTrade || Boolean(tradeRef));
  const phone = usePhoneLayout();
  const foldTrade = phone && source === 'sales';
  const [tradeOpen, setTradeOpen] = useState(startWithTrade || Boolean(tradeRef));
  const { close, go, open } = useDesk();
  const options = operationOptions[source];
  const productOptions = options?.products ?? [];
  const optionClients: (OperationClientOption | Client)[] = options?.clients ?? clients;
  const linkedProductId = currentSale?.productId || currentTrade?.draftProductId || preset?.productId || '';
  const linkedProduct = productOptions.find((item) => item.id === linkedProductId) ?? inventory.find((item) => item.id === linkedProductId);
  const [productId, setProductId] = useState(linkedProductId);
  const [deviceLabel, setDeviceLabel] = useState(currentSale?.deviceLabel || currentTrade?.draftDeviceLabel || (linkedProduct ? equipmentTitle(linkedProduct.model, linkedProduct.capacity) : ''));
  const [clientId, setClientId] = useState(currentSale?.clientId || currentTrade?.clientId || preset?.clientId || '');
  const receipts = useClientDeposits(currentSale ? '' : clientId);
  const [depositIds, setDepositIds] = useState<string[]>([]);
  const [creditNoteIds, setCreditNoteIds] = useState<string[]>([]);
  const openNotes = (context.creditNotes ?? []).filter((note) => note.clientId === clientId && note.remaining > 0 && !note.deletedAt);
  useEffect(() => { setDepositIds([]); setCreditNoteIds([]); }, [clientId, productId]);
  const [buyer, setBuyer] = useState(currentSale?.clientName?.trim() || currentTrade?.clientName?.trim() || preset?.clientName || clients.find((client) => client.id === (currentSale?.clientId || currentTrade?.clientId || preset?.clientId))?.name || '');
  const seededAmount = currentSale?.amount ?? currentTrade?.draftAmount;
  const seededCurrency = currentSale?.amountCurrency ?? currentTrade?.currency ?? productMoneyCurrency(linkedProduct);
  const [amount, setAmount] = useState(preset?.resumeAmount ? preset.resumeAmount : (seededAmount != null ? (money.inputValue(seededAmount, seededCurrency) || '0') : (linkedProduct?.price ? money.inputValue(linkedProduct.price, productMoneyCurrency(linkedProduct)) : '')));
  if (preset?.resumeAmount) dirty.current.add('amount');
  const [sellerMemberId, setSellerMemberId] = useState(currentSale?.sellerMemberId ?? '');
  const [sellerError, setSellerError] = useState('');
  useEffect(() => { if (context.loadCommissionSellers) void context.loadCommissionSellers().catch((cause: unknown) => setSellerError(toUserMessage(cause, 'No se pudieron cargar los vendedores'))); }, [context.appSession?.store?.id]);
  const [payment, setPayment] = useState(currentSale?.paymentMethod || currentTrade?.draftPaymentMethod || 'TRANSFERENCIA');
  const [paymentStatus, setPaymentStatus] = useState<'COMPLETADA' | 'PENDIENTE'>(currentSale?.status === 'PENDIENTE' ? 'PENDIENTE' : currentTrade?.draftPaymentStatus ?? 'COMPLETADA');
  const [settlement, setSettlement] = useState<SettlementState>({ active: false, error: null, payload: null });
  const [received, setReceived] = useState(currentTrade?.deviceReceived ?? '');
  const [imei, setImei] = useState(currentTrade?.deviceReceivedImei ?? '');
  const [take, setTake] = useState(currentTrade ? (money.inputValue(currentTrade.takeValue, currentTrade.currency) || '0') : '');
  const [technicalStatus, setTechnicalStatus] = useState(currentTrade?.status || 'PENDIENTE');
  const [battery, setBattery] = useState(currentTrade?.batteryHealth ?? '');
  const [grade, setGrade] = useState<string>(canonicalQuality(currentTrade?.grade));
  const [outgoingCapacity, setOutgoingCapacity] = useState('');
  const [outgoingColor, setOutgoingColor] = useState('');
  const [outgoingCondition, setOutgoingCondition] = useState('');
  const [outgoingImei, setOutgoingImei] = useState('');
  const [saleDate, setSaleDate] = useState(isoFromAr(currentSale?.date || currentTrade?.date));
  const usedWarrantyDays = context.appSession?.store?.usedWarrantyDays ?? DEFAULT_USED_WARRANTY_DAYS;
  const sealedWarrantyDays = context.appSession?.store?.sealedWarrantyDays ?? DEFAULT_SEALED_WARRANTY_DAYS;
  const [warrantyDays, setWarrantyDays] = useState(currentSale?.warrantyDays == null ? '' : String(currentSale.warrantyDays));
  const [bad, setBad] = useState<Record<string, string>>({});
  const [cameraFor, setCameraFor] = useState<null | 'sale' | 'trade'>(null);
  const tradeWedge = useRef(createWedgeBuffer());
  const tradeImeiRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasTrade) setTradeOpen(true);
  }, [hasTrade]);

  useEffect(() => {
    if (dirty.current.has('date')) return;
    const label = currentSale?.date || currentTrade?.date;
    if (label) setSaleDate(isoFromAr(label));
  }, [currentSale?.date, currentTrade?.date]);

  useEffect(() => {
    let active = true;
    loadOperationOptions(source).catch((err: unknown) => {
      if (active) setOptionError(getFriendlyErrorMessage(err, 'No se pudieron cargar las opciones.'));
    });
    return () => { active = false; };
  }, [source]);

  useEffect(() => {
    let active = true;
    const loadLinked = currentSale && saleId
      ? fetchSaleOperation(saleId)
      : tradeRef ? fetchTradeOperation(source, tradeRef) : null;
    loadLinked?.catch((err: unknown) => {
      if (active) setOptionError(getFriendlyErrorMessage(err, 'No se pudo cargar la operación vinculada.'));
    });
    return () => { active = false; };
  }, [saleId, tradeRef, source, currentSale?.integratedOperation]);

  useEffect(() => {
    const update = (key: string, action: () => void) => { if (!dirty.current.has(key)) action(); };
    if (currentSale) {
      update('sellerMemberId', () => setSellerMemberId(currentSale.sellerMemberId ?? ''));
      update('clientId', () => setClientId(currentSale.clientId || ''));
      update('buyer', () => setBuyer(currentSale.clientName?.trim() || clients.find((client) => client.id === currentSale.clientId)?.name || ''));
      update('productId', () => setProductId(currentSale.productId || ''));
      update('deviceLabel', () => setDeviceLabel(currentSale.deviceLabel || ''));
      update('amount', () => setAmount(money.inputValue(currentSale.amount, currentSale.amountCurrency) || '0'));
      update('payment', () => setPayment(currentSale.paymentMethod || 'TRANSFERENCIA'));
      update('paymentStatus', () => setPaymentStatus(currentSale.status === 'PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA'));
    }
    if (currentTrade) {
      update('hasTrade', () => setHasTrade(true));
      update('clientId', () => setClientId(currentTrade.clientId || ''));
      update('buyer', () => setBuyer(currentTrade.clientName?.trim() || clients.find((client) => client.id === currentTrade.clientId)?.name || ''));
      update('productId', () => setProductId(currentSale?.productId || currentTrade.draftProductId || ''));
      update('deviceLabel', () => setDeviceLabel(currentSale?.deviceLabel || currentTrade.draftDeviceLabel || currentTrade.deviceGiven || ''));
      const tradeAmount = currentTrade.confirmationStatus === 'PENDING'
        ? currentTrade.draftAmount
        : currentTrade.draftAmount ?? currentTrade.differencePaid + currentTrade.takeValue;
      update('amount', () => setAmount(money.inputValue(currentSale?.amount ?? tradeAmount ?? 0, currentSale?.amountCurrency ?? currentTrade.currency) || '0'));
      update('payment', () => setPayment(currentSale?.paymentMethod || currentTrade.draftPaymentMethod || 'TRANSFERENCIA'));
      update('paymentStatus', () => setPaymentStatus(currentSale ? (currentSale.status === 'PENDIENTE' ? 'PENDIENTE' : 'COMPLETADA') : currentTrade.draftPaymentStatus || 'COMPLETADA'));
      update('received', () => setReceived(currentTrade.deviceReceived || ''));
      update('imei', () => setImei(currentTrade.deviceReceivedImei || ''));
      update('take', () => setTake(money.inputValue(currentTrade.takeValue, currentTrade.currency) || '0'));
      update('technicalStatus', () => setTechnicalStatus(currentTrade.status || 'PENDIENTE'));
      update('battery', () => setBattery(currentTrade.batteryHealth || ''));
      update('grade', () => setGrade(canonicalQuality(currentTrade.grade)));
    }
    if (linkedProduct) {
      update('productId', () => setProductId(linkedProduct.id));
      update('deviceLabel', () => setDeviceLabel(equipmentTitle(linkedProduct.model, linkedProduct.capacity)));
      if (!currentSale && (!currentTrade || (currentTrade.confirmationStatus === 'PENDING' && currentTrade.draftAmount == null))) {
        update('amount', () => setAmount(linkedProduct.price > 0 ? money.inputValue(linkedProduct.price, productMoneyCurrency(linkedProduct)) : ''));
      }
    }
  }, [currentSale, currentTrade, linkedProduct, clients, money]);

  const selectedProduct = productId
    ? productOptions.find((item) => item.id === productId) ?? inventory.find((item) => item.id === productId)
    : undefined;
  const stockByImei = (imei: string) => equipmentItems.find((item) => (item.imei ?? '').replace(/\D/g, '') === imei && !('archivedAt' in item && item.archivedAt) && isInStock('status' in item ? item.status : 'DISPONIBLE'));
  const pickStock = (item: (typeof equipmentItems)[number]) => {
    dirty.current.add('deviceLabel');
    dirty.current.add('productId');
    dirty.current.add('amount');
    setDeviceLabel(equipmentTitle(item.model, item.capacity));
    setProductId(item.id);
    setOutgoingCapacity('');
    setOutgoingColor('');
    setOutgoingCondition('');
    setOutgoingImei('');
    if (!preset?.resumeAmount) setAmount(item.price > 0 ? money.inputValue(item.price, productMoneyCurrency(item)) : '');
    clearBad(setBad, 'equipment');
  };
  const applySaleScan = (raw: string) => {
    const parsed = parseDeviceCode(raw);
    const imei = parsed.imei;
    if (!imei) return;
    confirmScan();
    const hit = stockByImei(imei);
    if (hit) {
      pickStock(hit);
      return;
    }
    if (parsed.rich) {
      open({ type: 'scan-review', draft: draftFromCode(parsed), resume: { clientName: buyer, clientId, amount, source } });
      return;
    }
    dirty.current.add('deviceLabel');
    dirty.current.add('productId');
    setDeviceLabel(formatImei(imei));
    setProductId('');
    clearBad(setBad, 'equipment');
  };
  useEffect(() => {
    if (dirty.current.has('warranty')) return;
    if (currentSale) {
      setWarrantyDays(currentSale.warrantyDays == null ? '' : String(currentSale.warrantyDays));
      return;
    }
    const condition = selectedProduct?.condition || outgoingCondition;
    setWarrantyDays(String(defaultSaleWarrantyDays(condition, { usedWarrantyDays, sealedWarrantyDays })));
  }, [currentSale, selectedProduct?.id, selectedProduct?.condition, outgoingCondition, usedWarrantyDays, sealedWarrantyDays]);
  const catalogItems: (OperationProductOption | Product)[] = [
    ...productOptions,
    ...(linkedProduct && !productOptions.some((item) => item.id === linkedProduct.id) ? [linkedProduct] : []),
  ];
  const equipmentItems = catalogItems.filter((item) => item.reservedDepositId ? item.reservedClientId === clientId : item.id === productId || (item.pendingSaleRegistration ? !currentSale : (!('status' in item) || isInStock(item.status))));
  const reservedPool = [
    ...catalogItems,
    ...inventory.filter((item) => item.reservedDepositId && !catalogItems.some((option) => option.id === item.id)),
  ];
  const reservedHit = selectedProduct ? null : reservedForOtherClient(reservedPool, deviceLabel, clientId);
  const reservedName = reservedHit ? (reservedHit.reservedClientName || 'otro cliente') : null;
  const typedImei = deviceLabel.replace(/\s/g, '');
  const missingSaleImei = /^\d{15}$/.test(typedImei) && !selectedProduct && !reservedName;
  const priceEntered = amount.trim() !== '';
  const tradeGap = outgoingTradeDifference({
    registered: Boolean(selectedProduct),
    priceProvided: priceEntered,
    saleAmount: parseMoney(amount),
    takeValue: parseMoney(take),
  });
  const difference = tradeGap.difference;
  const hasConfirmedOperation = Boolean(currentSale?.integratedOperation || currentTrade?.confirmationStatus === 'CONFIRMED');
  const noStock = phone && source === 'tradeins' && Boolean(options) && equipmentItems.length === 0;

  const typedWarranty = parseWarrantyDaysInput(warrantyDays);
  const warrantyQuick = warrantyDays === '30' || warrantyDays === '60' || warrantyDays === '90' ? warrantyDays : 'otro';
  const warrantyPreview = warrantyDueCopy(saleDate, typedWarranty.error ? null : typedWarranty.days ?? null);
  const pickWarranty = (next: '30' | '60' | '90' | 'otro') => {
    dirty.current.add('warranty');
    clearBad(setBad, 'warranty');
    if (next === 'otro') {
      if (warrantyQuick !== 'otro') setWarrantyDays('');
      return;
    }
    setWarrantyDays(next);
  };
  const buildInput = (draft: boolean): OperationInput => ({
    ...(!currentSale && !draft && depositIds.length ? { depositIds } : {}),
    ...(!currentSale && !draft && creditNoteIds.length ? { creditNoteIds } : {}),
    sellerMemberId: sellerMemberId || null,
    ...(!currentSale && (settlement.payload?.exchangeRate || money.rate) ? { exchangeRate: settlement.payload?.exchangeRate || money.rate || undefined } : {}),
    date: arFromIso(saleDate),
    clientId: clientId || null,
    clientName: buyer.trim() || null,
    productId: productId || null,
    deviceLabel: deviceLabel.trim() || undefined,
    ...(!draft && source !== 'inventory' && !productId && deviceLabel.trim() ? { unlistedEquipment: {
      model: deviceLabel.trim(),
      capacity: outgoingCapacity.trim(),
      color: outgoingColor.trim(),
      condition: outgoingCondition,
      imei: outgoingImei.trim() || null,
      price: parseMoney(amount),
    } } : {}),
    ...(draft && !amount.trim() ? {} : { amount: parseMoney(amount) }),
    paymentMethod: payment,
    status: paymentStatus,
    ...(typedWarranty.days !== undefined ? { warrantyDays: typedWarranty.days } : {}),
    saleCategoryId: currentTrade?.draftSaleCategoryId ?? currentSale?.categoryId ?? null,
    categoryId: hasTrade ? currentTrade?.categoryId ?? null : currentSale?.categoryId ?? null,
    requestKey: requestKey.current,
    draft,
    ...(hasTrade ? { tradeIn: {
      deviceReceived: received.trim(),
      deviceReceivedImei: imei.trim(),
      takeValue: parseMoney(take),
      status: technicalStatus,
      batteryHealth: battery,
      grade,
      customFields: currentTrade?.customFields,
    }     } : currentSale ? { tradeIn: null } : {}),
    ...(!draft && settlement.active && settlement.payload ? settlement.payload : {}),
  });

  const validate = (kind: 'draft' | 'confirm') => {
    const next: Record<string, string> = {};
    if (kind === 'draft') {
      if (!hasTrade || !received.trim()) next.received = 'Completá el modelo recibido';
      if (hasTrade && imeiFormatError(imei)) next.imei = IMEI_FORMAT_MESSAGE;
      if (!take.trim()) next.take = 'Completá el valor tomado';
      if (amount.trim() && hasTrade && tradeGap.warning) next.amount = tradeGap.warning;
    } else {
      if (hasTrade && !buyer.trim()) next.client = 'Completá el nombre del cliente';
      if (source === 'clients' && !clientId) next.client = 'Elegí un cliente existente de la lista';
      if (reservedName) next.equipment = `Reservado para ${reservedName}`;
      else if (!deviceLabel.trim()) next.equipment = 'Completá el equipo';
      else if (!selectedProduct && deviceLabel.trim().length > INPUT_LIMITS.model) next.equipment = `El modelo puede tener hasta ${INPUT_LIMITS.model} caracteres`;
      if (source === 'inventory' && !productId && !reservedName) next.equipment = 'Elegí un equipo del inventario';
      if (!selectedProduct && outgoingColor.trim().length > INPUT_LIMITS.color) next.outgoingColor = `El color puede tener hasta ${INPUT_LIMITS.color} caracteres`;
      if (!selectedProduct && outgoingCapacity.trim().length > 50) next.outgoingCapacity = 'La capacidad puede tener hasta 50 caracteres';
      if (!selectedProduct && imeiFormatError(outgoingImei)) next.outgoingImei = IMEI_FORMAT_MESSAGE;
      if (!amount.trim() || (selectedProduct && selectedProduct.price <= 0 && parseMoney(amount) <= 0)) {
        next.amount = hasTrade && !selectedProduct ? MISSING_OUTGOING_PRICE : 'Completá el precio de salida';
      } else if (hasTrade && tradeGap.warning) next.amount = tradeGap.warning === NEGATIVE_TRADE_DIFFERENCE ? NEGATIVE_TRADE_DIFFERENCE : tradeGap.warning;
      if (hasTrade && !received.trim()) next.received = 'Completá el modelo recibido';
      if (hasTrade && imeiFormatError(imei)) next.imei = IMEI_FORMAT_MESSAGE;
      if (hasTrade && !take.trim()) next.take = 'Completá el valor tomado';
      const warranty = parseWarrantyDaysInput(warrantyDays);
      if (warranty.error) next.warranty = warranty.error;
      else if (!currentSale && warranty.days === undefined) next.warranty = 'Completá los días de garantía';
    }
    if (kind === 'confirm' && selectedProduct?.reservedDepositId && !depositIds.includes(selectedProduct.reservedDepositId)) next.equipment = 'Aplicá la seña que reservó este equipo antes de confirmar';
    if (kind === 'draft' && depositIds.length) next.amount = 'Quitá las señas para guardar pendiente; aplicalas al confirmar';
    if (kind === 'confirm' && depositIds.length && receipts.loading) next.amount = 'Esperá a que se carguen las señas';
    if (kind === 'confirm' && depositIds.length && appliedDeposits > cashDue) next.amount = 'Las señas superan el importe que falta pagar';
    if (kind === 'confirm' && !currentSale && settlement.error) next.amount = settlement.error;
    setBad(next);
    return Object.keys(next).length === 0;
  };
  const save = (kind: 'draft' | 'confirm') => {
    if (cancelled || busy || !validate(kind)) return;
    const includeAmount = !(kind === 'draft' && !amount.trim());
    const originalAmount = currentSale?.amount ?? currentTrade?.draftAmount ?? selectedProduct?.price ?? 0;
    const originalCurrency = currentSale?.amountCurrency ?? currentTrade?.currency ?? productMoneyCurrency(selectedProduct);
    const fields = [
      ...(includeAmount ? [{ typed: parseMoney(amount), original: originalAmount, currency: originalCurrency }] : []),
      ...(hasTrade ? [{ typed: parseMoney(take), original: currentTrade?.takeValue ?? 0, currency: currentTrade?.currency }] : []),
    ];
    const group = money.commitGroup(fields);
    if (group.blocked) {
      setBad({ amount: FX_WARNING });
      return;
    }
    const input = buildInput(kind === 'draft');
    const amountField = includeAmount ? group.amounts[0] : undefined;
    const takeField = hasTrade ? group.amounts[includeAmount ? 1 : 0] : undefined;
    if (amountField && input.amount !== undefined) input.amount = amountField.amount;
    const stamp = stampedCurrency(amountField?.currency ?? takeField?.currency);
    if (stamp) input.currency = stamp;
    if (takeField && input.tradeIn) input.tradeIn.takeValue = takeField.amount;
    void run(async () => {
      if (kind === 'draft') {
        if (tradeRef && currentTrade?.confirmationStatus === 'PENDING') {
          if (source !== 'tradeins' && currentTrade.operationSource !== source) throw new Error('Este borrador solo se puede editar desde su sección de origen.');
          return await updateTradeOperation(source, tradeRef, input);
        } else {
          return await createOperation(source, input);
        }
      }
      if (currentTrade?.confirmationStatus === 'PENDING' && tradeRef) {
        return await confirmTradeOperation(source, tradeRef, input);
      } else if (currentSale && saleId) {
        return await updateSaleOperation(saleId, input);
      } else if (hasTrade && hasConfirmedOperation && tradeRef && (source === 'sales' || source === 'tradeins')) {
        return await updateTradeOperation(source, tradeRef, input);
      } else {
        return await createOperation(source, { ...input, draft: false });
      }
    }, kind === 'draft' ? 'Borrador de canje guardado' : hasTrade ? 'Canje confirmado' : 'Venta registrada');
  };

  const title = currentSale ? 'Editar operación' : currentTrade ? 'Retomar canje' : hasTrade ? 'Nuevo canje' : 'Registrar venta';
  const sheetClass = [source === 'tradeins' ? 'cj-sheet' : 'sale-sheet'].join(' ');
  const typedCurrency = money.rate != null ? money.active : (currentSale?.amountCurrency ?? currentTrade?.currency);
  const cashDue = hasTrade ? difference ?? 0 : parseMoney(amount);
  const appliedDeposits = currentSale?.depositAppliedAmount ?? receipts.rows.filter(row => depositIds.includes(row.id) && depositAvailable(row)).reduce((sum, row) => sum + (depositAmount(row, typedCurrency ?? money.active, money.rate) ?? 0), 0);
  const dueCopy = appliedDeposits > 0 ? `Señas aplicadas: ${receiptMoney(appliedDeposits, typedCurrency ?? money.active)} · ${paymentStatus === 'PENDIENTE' ? 'Deuda pendiente' : 'Restante a cobrar'}: ${receiptMoney(Math.max(0, cashDue - appliedDeposits), typedCurrency ?? money.active)}` : hasTrade
    ? (difference == null ? (tradeGap.warning ?? 'Completá el precio de salida para calcular la diferencia') : `Diferencia a cobrar: ${money.show(difference, typedCurrency)}`)
    : paymentStatus === 'PENDIENTE' ? `Deuda pendiente: ${money.show(parseMoney(amount), typedCurrency)}` : 'Venta cobrada';
  const tradeBlock = (
    <>
      <label className="op-check"><input type="checkbox" checked={hasTrade} disabled={busy || (!saleId && Boolean(currentTrade))} onChange={(event) => { dirty.current.add('hasTrade'); setHasTrade(event.target.checked); }} />Tiene canje</label>
      {currentSale && currentTrade && !hasTrade ? <p className="eqs-note">Al guardar, se quitará el canje de esta venta y se archivará el equipo recibido. El canje quedará en el historial.</p> : null}
      {hasTrade ? (
        <>
          <div className="frow">
            <Field label="Equipo recibido" error={bad.received}><input value={received} onChange={(event) => { dirty.current.add('received'); setReceived(event.target.value); clearBad(setBad, 'received'); }} placeholder="Ej. iPhone 12" /></Field>
            <div className="scan-imei">
              <Field label={IMEI_OPTIONAL_LABEL} error={bad.imei}><input ref={tradeImeiRef} value={imei} inputMode="numeric" maxLength={15} autoComplete="off" onChange={(event) => { dirty.current.add('imei'); setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); clearBad(setBad, 'imei'); }} placeholder="15 dígitos" onKeyDown={(event) => {
                const pushed = tradeWedge.current.push(event.key);
                if (pushed.type !== 'scan') return;
                event.preventDefault();
                const parsed = parseDeviceCode(pushed.value);
                if (!parsed.imei) return;
                confirmScan();
                dirty.current.add('imei');
                setImei(parsed.imei);
                if (parsed.model && !received.trim()) { dirty.current.add('received'); setReceived([parsed.model, parsed.capacity].filter(Boolean).join(' ')); }
                focusNextControl(event.currentTarget);
              }} /></Field>
              <ScanCameraButton onClick={() => setCameraFor('trade')} />
            </div>
          </div>
          <div className="frow">
            <Field label="Valor tomado" mark={money.active} error={bad.take}><input value={take} inputMode="numeric" onChange={(event) => { dirty.current.add('take'); setTake(operationMoneyInput(event.target.value)); clearBad(setBad, 'take'); }} placeholder="$ 0" /></Field>
            <Field label="Diferencia"><input aria-label="Diferencia" value={difference == null ? '' : money.show(difference, typedCurrency)} readOnly placeholder={difference == null && tradeGap.warning !== NEGATIVE_TRADE_DIFFERENCE ? 'Completá el precio' : undefined} /></Field>
          </div>
          <Field label="Estado técnico"><span /></Field>
          <Segs options={catalogChoices(catalogs?.options ?? [], 'TRADE_IN_STATUS', CJ_STATUS)} value={technicalStatus} onChange={setTechnicalStatus} onEdit={catalogs?.canEdit ? () => setEditor('TRADE_IN_STATUS') : undefined} />
          <Field label="Batería recibida"><input value={battery} onChange={(event) => setBattery(event.target.value)} placeholder="Opcional" /></Field>
          <QualityField label="Calidad del recibido" value={grade} onChange={(next) => { dirty.current.add('grade'); setGrade(next); }} />
        </>
      ) : null}
    </>
  );
  return (
    <>
    <Sheet title={title} subtitle={currentSale ? `${saleCode(currentSale)} · ${formatShortDate(currentSale.date)}` : 'La venta y el canje se guardan como una sola operación.'} onClose={close} busy={busy} className={sheetClass || undefined} footer={
      <SheetActions>
          <button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button>
        {hasTrade && !currentSale && !hasConfirmedOperation && (!tradeRef || source === 'tradeins' || currentTrade?.operationSource === source) ? <SheetActionMenu><button className="btn2 s" type="button" disabled={busy || cancelled} onClick={() => save('draft')}>{busy ? 'Guardando…' : 'Guardar pendiente'}</button></SheetActionMenu> : null}
        <button className="btn2 p sheet-primary" type="button" disabled={busy || cancelled} onClick={() => save('confirm')}>{busy ? 'Guardando…' : currentSale || hasConfirmedOperation ? 'Guardar cambios' : hasTrade ? 'Confirmar canje' : 'Confirmar venta'}</button>
      </SheetActions>
    }>
      {cancelled ? <div className="ferr">Esta venta está cancelada y no se puede editar.</div> : null}
      {error && <div ref={errorRef} className="ferr">{error}</div>}
      {optionError && <div className="ferr">{optionError}</div>}
      <ClientField
        clients={optionClients}
        value={buyer}
        linked={Boolean(clientId)}
        error={bad.client}
        onValue={(value) => { dirty.current.add('buyer'); dirty.current.add('clientId'); setBuyer(value); setClientId(''); clearBad(setBad, 'client'); }}
        onPick={(client) => { dirty.current.add('buyer'); dirty.current.add('clientId'); setBuyer(client.name); setClientId(client.id); clearBad(setBad, 'client'); }}
      />
      <EquipmentField
        items={equipmentItems}
        value={deviceLabel}
        linked={Boolean(selectedProduct)}
        reservedName={reservedName}
        error={bad.equipment}
        imeiMissing={missingSaleImei}
        onCamera={() => setCameraFor('sale')}
        onScan={applySaleScan}
        onValue={(value) => {
          const digits = value.replace(/\s/g, '');
          if (/^\d{15}$/.test(digits)) {
            const hit = stockByImei(digits);
            if (hit) { pickStock(hit); return; }
            dirty.current.add('deviceLabel');
            dirty.current.add('productId');
            setDeviceLabel(formatImei(digits));
            setProductId('');
            clearBad(setBad, 'equipment');
            return;
          }
          dirty.current.add('deviceLabel');
          dirty.current.add('productId');
          setDeviceLabel(value);
          setProductId('');
          clearBad(setBad, 'equipment');
        }}
        onPick={(item) => pickStock(item)}
      />
      {missingSaleImei ? (
        <div className="scan-warn" data-testid="sale-missing-imei">
          <b>Este IMEI no está en tu stock</b>
          <p>Registralo ahora y seguís con la venta, sin perder lo que cargaste.</p>
          <button type="button" className="btn2 s" disabled={busy} onClick={() => open({ type: 'scan-review', draft: draftFromImei(typedImei), resume: { clientName: buyer, clientId, amount, source } })}>+ Registrar equipo</button>
        </div>
      ) : null}
      {deviceLabel.trim() && !selectedProduct && !reservedName && !missingSaleImei ? (
        <div className="unlisted-eq" data-testid="unlisted-equipment">
          <p className="eqs-note">Se crea en el inventario marcado para completar. El texto de arriba es el modelo.</p>
          <div className="frow">
            <Field label="Capacidad" error={bad.outgoingCapacity}><input value={outgoingCapacity} onChange={(event) => { dirty.current.add('outgoingCapacity'); setOutgoingCapacity(event.target.value); clearBad(setBad, 'outgoingCapacity'); }} placeholder="Ej. 128GB" /></Field>
            <Field label="Color" error={bad.outgoingColor}><input value={outgoingColor} onChange={(event) => { dirty.current.add('outgoingColor'); setOutgoingColor(event.target.value); clearBad(setBad, 'outgoingColor'); }} placeholder="Ej. Azul" /></Field>
          </div>
          <Field label="Condición"><span /></Field>
          <Segs options={BASE_CONDITIONS} value={outgoingCondition} onChange={(next) => { dirty.current.add('outgoingCondition'); setOutgoingCondition(next); }} allowClear />
          <Field label="IMEI del vendido (opcional)" error={bad.outgoingImei}><input value={outgoingImei} inputMode="numeric" maxLength={15} onChange={(event) => { dirty.current.add('outgoingImei'); setOutgoingImei(event.target.value.replace(/\D/g, '').slice(0, 15)); clearBad(setBad, 'outgoingImei'); }} placeholder="15 dígitos" /></Field>
        </div>
      ) : null}
      {selectedProduct && isUsedCondition(selectedProduct.condition) ? <p className="eqs-note">Calidad: {displayQuality(selectedProduct.condition, selectedProduct.grade) ? qualityDetail(displayQuality(selectedProduct.condition, selectedProduct.grade)) : 'sin cargar'}</p> : null}
      <ReportDatePicker label="Fecha de la venta" value={saleDate} onChange={(value) => { dirty.current.add('date'); setSaleDate(value); }} />
      <Field label="Garantía" error={bad.warranty}><span /></Field>
      <div className="sgs warranty-presets" role="group" aria-label="Garantía">
        {(['30', '60', '90'] as const).map((days) => (
          <button key={days} type="button" className={`sg${warrantyQuick === days ? ' on' : ''}`} aria-pressed={warrantyQuick === days} onClick={() => pickWarranty(days)}>{days} días</button>
        ))}
        <button type="button" className={`sg${warrantyQuick === 'otro' ? ' on' : ''}`} aria-pressed={warrantyQuick === 'otro'} onClick={() => pickWarranty('otro')}>Otro</button>
      </div>
      {warrantyQuick === 'otro' ? (
        <div className="warranty-other">
          <input data-testid="sale-warranty-days" aria-label="Días de garantía" inputMode="numeric" value={warrantyDays} placeholder="0" onChange={(event) => { dirty.current.add('warranty'); setWarrantyDays(event.target.value.replace(/\D/g, '').slice(0, 4)); clearBad(setBad, 'warranty'); }} />
          <span>días</span>
        </div>
      ) : null}
      {warrantyPreview ? <p className={`eqs-note${warrantyPreview.startsWith('Vence') ? ' ok' : ''}`} data-testid="sale-warranty-until">{warrantyPreview}</p> : null}
      {noStock ? (
        <div className="eqs-note cj-nostock" data-testid="trade-no-stock">
          <span>No hay equipos disponibles en el inventario.</span>
          <button type="button" className="wlink" disabled={busy} onClick={() => { close(); go('inventory'); }}>Ir a inventario</button>
        </div>
      ) : null}
      {source === 'clients' ? <p className="eqs-note">Elegí un cliente existente para registrar la venta desde su ficha.</p> : null}
      {foldTrade ? null : tradeBlock}
      <Field label="Precio completo de salida" mark={money.active} error={bad.amount}><input value={amount} inputMode="numeric" onChange={(event) => { dirty.current.add('amount'); setAmount(operationMoneyInput(event.target.value)); clearBad(setBad, 'amount'); }} placeholder="$ 0" /></Field>
      {selectedProduct && selectedProduct.price <= 0 ? <p className="eqs-note">Este equipo no tiene precio. Completá el precio de salida para registrar la venta.</p> : null}
      <p className="op-summary">{dueCopy}</p>
      {!currentSale ? <DepositChoices receipts={receipts} clientId={clientId} productId={productId} selected={depositIds} onChange={setDepositIds} currency={typedCurrency ?? money.active} rate={money.rate} maximum={cashDue} busy={busy} /> : null}
      {!currentSale && openNotes.length ? (
        <div data-testid="sale-credit-notes">
          <Field label="Notas de crédito"><span /></Field>
          {openNotes.map((note) => (
            <label className="op-check" key={note.id}>
              <input
                type="checkbox"
                checked={creditNoteIds.includes(note.id)}
                disabled={busy || settlement.active}
                onChange={(event) => setCreditNoteIds((current) => event.target.checked ? [...current, note.id] : current.filter((id) => id !== note.id))}
              />
              {note.code} · quedan {money.show(note.remaining, note.currency)}
            </label>
          ))}
          {settlement.active ? <p className="eqs-note">La nota se aplica en un cobro simple, sin cuotas ni varios medios.</p> : null}
        </div>
      ) : null}
      {!currentSale ? <SalePaymentsFields clientId={clientId} due={Math.max(0, cashDue - appliedDeposits)} currency={typedCurrency === 'USD' ? 'USD' : 'ARS'} suggestedRate={money.rate} onChange={setSettlement} /> : null}
      {settlement.active ? null : <><Field label="Forma de pago"><span /></Field>
      <Segs options={PAYMENTS} value={payment} onChange={setPayment} /></>}
      {foldTrade ? (
        <details className="op-fold" data-testid="sale-trade-fold" open={tradeOpen} onToggle={(event) => setTradeOpen(event.currentTarget.open)}>
          <summary>Canje como parte de pago</summary>
          <div className="op-fold-body">{tradeBlock}</div>
        </details>
      ) : null}
      {settlement.active ? <p className="eqs-note">El estado de cobro sale de los pagos y las cuotas.</p> : <><Field label="Cobro"><span /></Field>
      <Segs options={[{ id: 'COMPLETADA', label: 'Cobrado' }, { id: 'PENDIENTE', label: 'Pendiente' }]} value={paymentStatus} onChange={(value) => setPaymentStatus(value as 'COMPLETADA' | 'PENDIENTE')} /></>}
      {sellerError ? <div className="ferr" role="alert">{sellerError}</div> : null}
      <SellerField value={sellerMemberId} onChange={value => { dirty.current.add('sellerMemberId'); setSellerMemberId(value); }} busy={busy} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
    </Sheet>
    {cameraFor ? (
      <CameraScanner
        allowCameraSwitch={source !== 'sales' && source !== 'inventory'}
        onClose={() => setCameraFor(null)}
        onManual={() => setCameraFor(null)}
        onUse={(parsed) => {
          const target = cameraFor;
          setCameraFor(null);
          if (target === 'trade') {
            if (!parsed.imei) return;
            confirmScan();
            dirty.current.add('imei');
            setImei(parsed.imei);
            if (parsed.model && !received.trim()) { dirty.current.add('received'); setReceived([parsed.model, parsed.capacity].filter(Boolean).join(' ')); }
            if (tradeImeiRef.current) focusNextControl(tradeImeiRef.current);
            return;
          }
          if (parsed.imei && stockByImei(parsed.imei)) {
            applySaleScan(parsed.imei);
            return;
          }
          if (parsed.rich) {
            open({ type: 'scan-review', draft: draftFromCode(parsed), resume: { clientName: buyer, clientId, amount, source } });
            return;
          }
          applySaleScan(parsed.imei ?? '');
        }}
      />
    ) : null}
    </>
  );
}

export function SaleDetail({ id, run, busy, error }: FormProps & { id: string }) {
  const { sales, clients, inventory, tradeIns, user, updateSale, fetchSaleOperation, commissionSellers = [], loadCommissionSellers } = useAppContext();
  const money = useMoney();
  const { close, open, toast, canManageSensitive = true } = useDesk();
  const sale = sales.find((item) => item.id === id) ?? voidedSale(id);
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => { if (loadCommissionSellers) void loadCommissionSellers().catch((cause: unknown) => setDetailError(toUserMessage(cause, 'No se pudieron cargar los vendedores'))); }, []);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [movements, setMovements] = useState<ClientPaymentRecord[]>([]);
  const [accountDue, setAccountDue] = useState<number | null>(null);
  const buyerPending = clients.find((item) => item.id === sale?.clientId)?.pendingBalance;
  useEffect(() => {
    if (!user || !sale?.clientId) return;
    let active = true;
    fetchClientPayments(user, sale.clientId).then((rows) => { if (active) setMovements(rows); }).catch(() => undefined);
    return () => { active = false; };
  }, [user, sale?.clientId, sale?.openBalance, sale?.status, sale?.amount, buyerPending]);
  useEffect(() => { setAccountDue(null); }, [id]);
  useEffect(() => {
    if (sale?.integratedOperation) void fetchSaleOperation(id).catch((err: unknown) => setDetailError(getFriendlyErrorMessage(err, 'No se pudo cargar la operación.')));
  }, [id, sale?.integratedOperation]);
  if (!sale) return null;
  const linkedTrade = sale.tradeInId ? tradeIns.find((item) => item.id === sale.tradeInId) : undefined;
  const cash = (linkedTrade ? linkedTrade.differencePaid : sale.amount) - (sale.depositAppliedAmount ?? 0);
  const refundTarget = { id: sale.id, cash, status: sale.status, openBalance: sale.openBalance, soldAt: sale.date };
  const refundSales = sales.filter((item) => item.clientId && item.clientId === sale.clientId && item.status !== 'CANCELADA').map((item): RefundTarget => {
    const trade = item.tradeInId ? tradeIns.find((row) => row.id === item.tradeInId) : undefined;
    return { id: item.id, cash: Math.max(0, (trade ? trade.differencePaid : item.amount) - (item.depositAppliedAmount ?? 0)), status: item.status, openBalance: item.openBalance, soldAt: item.date };
  });
  const buyer = clients.find((item) => item.id === sale.clientId);
  const displayedDue = accountDue ?? displayedSaleDue(refundTarget, refundSales, movements, buyer?.pendingBalance ?? 0);
  const plan = (sale.integratedOperation || sale.tradeInId) && sale.status !== 'CANCELADA'
    ? cancellationPlan(refundTarget, refundSales, movements, buyer?.pendingBalance ?? 0)
    : { refund: 0, credit: 0 };
  if (confirmCancel) {
    return (
      <ConfirmOperationDialog
        label={saleCode(sale)}
        refund={plan.refund}
        coveredCredit={plan.credit}
        depositCredit={sale.depositAppliedAmount}
        busy={busy}
        error={error}
        onClose={() => { if (!busy) setConfirmCancel(false); }}
        currency={sale.amountCurrency}
        onOk={() => { void run(async () => await updateSale({ ...sale, status: 'CANCELADA' }), 'Operación cancelada'); }}
      />
    );
  }
  const integrated = Boolean(sale.integratedOperation || sale.tradeInId);
  const sold = inventory.find((item) => item.id === sale.productId);
  const soldQuality = sold ? displayQuality(sold.condition, sold.grade) : '';
  const coverage = saleWarrantyView(sale);
  return (
    <Sheet title={saleCode(sale)} subtitle={formatShortDate(sale.date)} onClose={close} busy={busy} className="sale-sheet sale-detail-sheet" footer={
      sale.voidedAt ? <SheetActions><button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button></SheetActions> : sale.status === 'PENDIENTE' ? (
        <SheetActions>
          <button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button>
          {canManageSensitive || integrated ? <SheetActionMenu>
            {canManageSensitive ? <button className="btn2 s" type="button" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancelar venta</button> : null}
            {integrated ? <button className="btn2 s" type="button" disabled={busy} onClick={() => open({ type: 'edit-sale', id })}>Editar</button> : null}
          </SheetActionMenu> : null}
          <button className="btn2 p sheet-primary" type="button" disabled={busy} onClick={() => run(async () => await updateSale({ ...sale, status: 'COMPLETADA' }), `${saleCode(sale)} cobrada`)}>Marcar cobrada</button>
        </SheetActions>
      ) : (
        <SheetActions>
          <button className="btn2 s sheet-secondary" type="button" disabled={busy} onClick={close}>Cerrar</button>
          {integrated && canManageSensitive || sale.status !== 'CANCELADA' ? <SheetActionMenu>
            {integrated && canManageSensitive ? <button className="btn2 danger" type="button" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancelar operación</button> : null}
            {sale.status !== 'CANCELADA' ? <button className="btn2 s" type="button" disabled={busy} onClick={() => open({ type: 'edit-sale', id })}>Editar</button> : null}
            {sale.status === 'COMPLETADA' ? <button className="btn2 s" type="button" disabled={busy} onClick={() => open({ type: 'new-return', saleId: id })}>Devolver</button> : null}
          </SheetActionMenu> : null}
          <button className="btn2 p sheet-primary" type="button" onClick={() => {
            const text = [
              saleCode(sale),
              saleBuyer(sale, clients),
              saleEquipment(sale, inventory),
              sold?.imei ? `IMEI ${formatImei(sold.imei)}` : null,
              soldQuality ? `Calidad ${soldQuality}` : null,
              money.show(sale.amount, sale.amountCurrency),
              paymentLabel(sale.paymentMethod),
              sale.status === 'PENDIENTE' ? `Debe ${receiptMoney(displayedDue, sale.amountCurrency ?? money.active)}` : `Pagó ${money.show(sale.amount, sale.amountCurrency)}`,
              coverage.phrase,
            ].filter(Boolean).join(' · ');
            const copy = () => navigator.clipboard.writeText(text).then(() => toast('Comprobante copiado'));
            shareOrCopy({ title: saleCode(sale), text }, copy);
          }}>Compartir comprobante</button>
        </SheetActions>
      )
    }>
      {error && <div className="ferr">{error}</div>}{detailError && <div className="ferr">{detailError}</div>}
      {sale.voidedAt ? <div className="pending-sale" data-testid="voided-banner"><div><b>Anulada</b><small>{sale.voidedBy ? `por ${sale.voidedBy}` : 'Esta venta está anulada'}{sale.voidReason ? ` · ${sale.voidReason}` : ''}. No se puede restaurar.</small></div></div> : null}
      <div className="dhero"><div className="eb">Precio completo de salida</div><div className="big">{money.show(sale.amount, sale.amountCurrency)}</div></div>
      {sale.status === 'CANCELADA' ? <AuditLine action="Cancelada" by={sale.cancelledBy} at={sale.cancelledAt} /> : null}
      <RecordHistory entityType="sale" entityId={sale.id} />
      <div className="kv"><span>Cliente</span><b>{saleBuyer(sale, clients)}</b></div>
      <div className="kv"><span>Equipo</span><b>{saleEquipment(sale, inventory)}</b></div>
      <div className="kv"><span>Calidad</span><b>{soldQuality ? qualityDetail(soldQuality) : '—'}</b></div>
      <div className="kv"><span>Vendedor</span><b>{commissionSellers.find(person => person.id === sale.sellerMemberId)?.name ?? (sale.sellerMemberId ? 'Vendedor no disponible' : 'Sin vendedor')}</b></div>
      <div className="kv"><span>Pago</span><b>{paymentLabel(sale.paymentMethod)}</b></div>
      <div className="kv"><span>Cobro</span><b>{sale.status === 'PENDIENTE' ? `Deuda ${receiptMoney(displayedDue, sale.amountCurrency ?? money.active)}` : <Pill status={sale.status} kind="SALE_STATUS" />}</b></div>
      <div className="kv" data-testid="sale-warranty"><span>Garantía</span><b>{coverage.phrase}</b></div>
      <SaleAccountPanel saleId={sale.id} revision={`${sale.status}:${sale.openBalance ?? ''}:${sale.amount}:${buyer?.pendingBalance ?? ''}:${movements.map((row) => row.id).join(',')}`} onDue={setAccountDue} />
      {linkedTrade ? <section className="sale-detail-trade" aria-label="Canje como parte de pago">
        <h4>Canje como parte de pago</h4>
        <div className="sale-detail-trade-grid">
          <div className="kv"><span>Equipo recibido</span><b>{linkedTrade.deviceReceived || '—'}</b></div>
          <div className="kv"><span>Calidad recibida</span><b>{tradeQuality(linkedTrade.grade) ? qualityDetail(tradeQuality(linkedTrade.grade)) : '—'}</b></div>
          <div className="kv"><span>Valor tomado</span><b>{money.show(linkedTrade.takeValue, linkedTrade.currency)}</b></div>
          <div className="kv"><span>Diferencia del canje</span><b>{money.show(linkedTrade.differencePaid, linkedTrade.currency)}</b></div>
          <div className="kv"><span>Estado técnico</span><b><Pill status={linkedTrade.status} kind="TRADE_IN_STATUS" /></b></div>
          <div className="kv"><span>Confirmación</span><b>{linkedTrade.confirmationStatus === 'PENDING' ? 'Venta por registrar' : linkedTrade.confirmationStatus === 'CANCELLED' ? 'Cancelado' : 'Confirmado'}</b></div>
        </div>
      </section> : null}
    </Sheet>
  );
}
