import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Vehicle } from '../lib/vehicleTypes';

// Create a Sale from an inventory vehicle (§29).
export function SellModal({ vehicle, onClose, onSaved }: { vehicle: Vehicle; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [salePrice, setSalePrice] = useState(vehicle.sellingPrice ? String(vehicle.sellingPrice) : '');
  const [paymentType, setPaymentType] = useState('CASH');
  const [financeProduct, setFinanceProduct] = useState('');
  const [margin, setMargin] = useState('');
  const [discounted, setDiscounted] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountComment, setDiscountComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Look up brand/dealership IDs by name is not ideal; the vehicle card carries names only.
  // We fetch the raw lists to map back to IDs.
  async function save() {
    setBusy(true);
    setError('');
    try {
      const [brands, dealerships] = await Promise.all([
        api.get<{ brands: { id: string; name: string }[] }>('/api/brands'),
        api.get<{ dealerships: { id: string; dealershipName: string }[] }>('/api/dealerships'),
      ]);
      const brandId = brands.brands.find((b) => b.name === vehicle.brand)?.id;
      const dealershipId = dealerships.dealerships.find((d) => d.dealershipName === vehicle.dealership)?.id;
      if (!brandId || !dealershipId) { setError('Mapping failed'); setBusy(false); return; }

      await api.post('/api/sales', {
        vehicleId: vehicle.id,
        dealershipId,
        brandId,
        model: vehicle.model,
        vin: vehicle.vin,
        customerName: name || undefined,
        phone,
        salePrice: Number(salePrice || 0),
        paymentType,
        financeProductText: financeProduct || null,
        manualMargin: Number(margin || 0),
        discountedSale: discounted,
        discountAmount: discounted ? Number(discountAmount || 0) : null,
        discountComment: discounted ? discountComment || null : null,
      });
      onSaved();
    } catch {
      setError('Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('veh.sell')}: {vehicle.brand} {vehicle.model}</h2>
        <div className="muted small mono">{vehicle.vin}</div>
        <label>{t('lead.name')}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t('lead.phone')} <span className="req">*</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" required />
        </label>
        <label>{t('veh.salePrice')} <span className="req">*</span>
          <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
        </label>
        <label>{t('veh.paymentType')}
          <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
            <option value="CASH">{t('veh.cash')}</option>
            <option value="CREDIT">{t('veh.credit')}</option>
            <option value="OTHER">{t('veh.other')}</option>
          </select>
        </label>
        {paymentType === 'CREDIT' && (
          <label>{t('veh.financeProduct')}<input value={financeProduct} onChange={(e) => setFinanceProduct(e.target.value)} /></label>
        )}
        <label>{t('veh.manualMargin')} <span className="req">*</span>
          <input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="15000000" />
        </label>
        <label className="check">
          <input type="checkbox" checked={discounted} onChange={(e) => setDiscounted(e.target.checked)} />
          {t('veh.discountedSale')}
        </label>
        {discounted && (
          <>
            <label>{t('veh.discountAmount')}<input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} /></label>
            <label>{t('veh.discountComment')}<input value={discountComment} onChange={(e) => setDiscountComment(e.target.value)} /></label>
          </>
        )}
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('lead.cancel')}</button>
          <button className="btn-primary" disabled={busy || !phone || !margin} onClick={save}>{t('lead.save')}</button>
        </div>
      </div>
    </div>
  );
}
