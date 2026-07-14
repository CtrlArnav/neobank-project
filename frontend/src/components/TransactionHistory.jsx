import React, { useState, useEffect } from 'react';

function TransactionHistory({ account, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (account) {
      fetchTransactions();
    }
  }, [account]);

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/accounts/${account.accountNumber}/transactions`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }

      setTransactions(data.transactions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return <div className="alert alert-error">No account selected</div>;
  }

  return (
    <div>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '2rem' }}>
        ← Back to Dashboard
      </button>

      <div className="card">
        <h2>{account.name}'s Account</h2>
        <div className="balance">₹{(account.balance / 100).toFixed(2)}</div>
        
        <div className="account-info">
          <div className="info-item">
            <label>Account Number</label>
            <span>{account.accountNumber}</span>
          </div>
          <div className="info-item">
            <label>Email</label>
            <span>{account.email}</span>
          </div>
          <div className="info-item">
            <label>Daily Limit</label>
            <span>₹{(account.dailyLimit / 100).toFixed(2)}</span>
          </div>
          <div className="info-item">
            <label>Daily Spent</label>
            <span>₹{(account.dailySpent / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Transaction History</h2>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        {loading ? (
          <div className="empty-state">
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions yet</p>
          </div>
        ) : (
          <div>
            {transactions.map((tx, idx) => (
              <div key={idx} className="transaction">
                <div className="transaction-info">
                  <div className={`transaction-type ${tx.type.toLowerCase()}`}>
                    {tx.type}
                  </div>
                  <div className="transaction-description">
                    {tx.description}
                    <br />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(tx.createdAt).toLocaleString()}
                    </small>
                  </div>
                </div>
                <div className={`transaction-amount ${tx.type.toLowerCase()}`}>
                  {tx.type === 'DEBIT' ? '-' : '+'}₹{(tx.amount / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionHistory;
