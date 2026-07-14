import React from 'react';

function Dashboard({ accounts, onSelectAccount, onCreateAccount, onTransfer }) {
  return (
    <div>
      <div className="card">
        <h2>Your Accounts</h2>
        
        {accounts.length === 0 ? (
          <div className="empty-state">
            <p>No accounts yet</p>
            <button className="btn btn-primary" onClick={onCreateAccount}>
              Create Your First Account
            </button>
          </div>
        ) : (
          <>
            <div className="grid">
              {accounts.map((account) => (
                <div 
                  key={account.accountNumber}
                  className="card account-card"
                  onClick={() => onSelectAccount(account)}
                >
                  <h3>{account.name}</h3>
                  <div className="balance">₹{(account.balance / 100).toFixed(2)}</div>
                  <div className="account-number">
                    {account.accountNumber}
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn btn-secondary" onClick={onCreateAccount}>
                + New Account
              </button>
              <button className="btn btn-primary" onClick={onTransfer}>
                Transfer Money
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
