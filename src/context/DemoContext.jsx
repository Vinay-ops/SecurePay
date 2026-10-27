import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { demoService } from '../services/api';

/**
 * DemoContext - replaces the old authenticated session.
 * Provides the shared demo identities and their live server-side balances.
 * No token, no login, no registration: the backend demo routes are open.
 */
const DemoContext = createContext(null);

export const DemoProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [storageMode, setStorageMode] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await demoService.getAccounts();
      if (data && data.success) {
        setAccounts(data.accounts || []);
        setStorageMode(data.storageMode || '');
        setNote(data.note || '');
        setError('');
      }
    } catch (err) {
      setError('Unable to load demo accounts. Is the backend running on port 5000?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getAccount = (nameOrEmail) =>
    accounts.find(
      (a) =>
        a.name === nameOrEmail ||
        a.email === nameOrEmail ||
        a.displayName === nameOrEmail
    ) || null;

  return (
    <DemoContext.Provider
      value={{
        accounts,
        storageMode,
        note,
        loading,
        error,
        refresh,
        getAccount,
        sender: accounts[0] || null,
        receiver: accounts[1] || null,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => useContext(DemoContext);

export default DemoContext;
