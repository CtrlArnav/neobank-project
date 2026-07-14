import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

function Transfer({ accounts, onSuccess, onCancel }) {
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      // Generate idempotency key to prevent duplicate transactions
      const idempotencyKey = uuidv4();

      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          fromAccountNumber: fromAccount,
          toAccountNumber: toAccount,
          amount: parseFloat(amount),
          description: description || 'Transfer'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transfer failed');
      }

      setSuccess(true);
      
      // Update local storage with new balances
      const updatedAccounts = accounts.map(acc => {
        if (acc.accountNumber === fromAccount) {
          return { ...acc, balance: data.fromAccount.balance };
        }
        if (acc.accountNumber === toAccount) {
          return { ...acc, balance: data.toAccount.balance };
        }
        return acc;
      });
      localStorage.setItem('neobank_accounts', JSON.stringify(updatedAccounts));

      setTimeout(() => onSuccess(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Transfer Money</h2>
      
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">Transfer successful!</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>From Account</label>
          <select
            value={fromAccount}
            onChange={(e) => setFromAccount(e.target.value)}
            required
          >
            <option value="">Select account</option>
            {accounts.map((acc) => (
              <option key={acc.accountNumber} value={acc.accountNumber}>
                {acc.name} - ₹{(acc.balance / 100).toFixed(2)} ({acc.accountNumber})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>To Account Number</label>
          <input
            type="text"
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value)}
            placeholder="ACC1234567890"
            required
          />
        </div>

        <div className="form-group">
          <label>Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="100.00"
            required
          />
        </div>

        <div className="form-group">
          <label>Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Rent payment"
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || !fromAccount || !toAccount || !amount}>
            {loading ? 'Processing...' : 'Transfer'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>

      <div className="security-info">
        <strong>Security Features</strong>
        <ul>
          <li>Idempotency key prevents duplicate transactions</li>
          <li>ACID transactions ensure atomicity</li>
          <li>Optimistic locking prevents race conditions</li>
          <li>Fraud risk scoring analyzes 5 signals</li>
        </ul>
      </div>
    </div>
  );
}

export default Transfer;
