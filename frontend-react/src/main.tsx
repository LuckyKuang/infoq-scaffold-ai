import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/lang';
import '@/styles/index.scss';
import RootProviders from '@/RootProviders';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootProviders />
  </React.StrictMode>
);
