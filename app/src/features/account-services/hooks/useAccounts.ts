import { useEffect } from 'react';
import { useAccountServicesStore } from '../store/accountStore';

export const useAccounts = () => {
  const store = useAccountServicesStore();

  useEffect(() => {
    store.loadAccounts();
  }, []);

  return store;
};
