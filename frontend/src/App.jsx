import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Transfer from './components/Transfer';
import TransactionHistory from './components/TransactionHistory';
import CreateAccount from './components/CreateAccount';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    // Load accounts from localStorage (in real app, fetch from API)
    const savedAccounts = JSON.parse(localStorage.getItem('neobank_accounts') || '[]');
    setAccounts(savedAccounts);
  }, []);

  const addAccount = (account) => {
    const updatedAccounts = [...accounts, account];
    setAccounts(updatedAccounts);
    localStorage.setItem('neobank_accounts', JSON.stringify(updatedAccounts));
    setCurrentView('dashboard');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            accounts={accounts}
            onSelectAccount={(acc) => {
              setSelectedAccount(acc);
              setCurrentView('transactions');
            }}
            onCreateAccount={() => setCurrentView('create')}
            onTransfer={() => setCurrentView('transfer')}
          />
        );
      case 'create':
        return <CreateAccount onAccountCreated={addAccount} onCancel={() => setCurrentView('dashboard')} />;
      case 'transfer':
        return <Transfer accounts={accounts} onSuccess={() => setCurrentView('dashboard')} onCancel={() => setCurrentView('dashboard')} />;
      case 'transactions':
        return (
          <TransactionHistory 
            account={selectedAccount}
            onBack={() => setCurrentView('dashboard')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <header className="header">
        <div className="container">
          <h1>NeoBank</h1>
          <p>Concurrent-Safe Digital Banking Ledger</p>
        </div>
      </header>
      
      <div className="container">
        {renderView()}
      </div>
    </div>
  );
}

export default App;
