import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';

const CryptoBadge = ({ status, text }) => {
  const normStatus = String(status || '').toUpperCase();

  if (normStatus === 'SUCCESS' || normStatus === 'COMPLETED' || normStatus === 'VERIFIED' || normStatus === 'PASSED' || status === true) {
    return (
      <span className="badge badge-success">
        <CheckCircle2 size={12} />
        {text || 'VERIFIED'}
      </span>
    );
  }

  if (normStatus === 'TAMPERED' || normStatus === 'REJECTED' || normStatus === 'FAILED' || normStatus === 'BLOCKED' || status === false) {
    return (
      <span className="badge badge-danger">
        <XCircle size={12} />
        {text || (normStatus === 'TAMPERED' ? 'TAMPERED' : 'REJECTED')}
      </span>
    );
  }

  if (normStatus === 'WARNING' || normStatus === 'ANOMALY' || normStatus === 'STALE' || normStatus === 'EXPIRED') {
    return (
      <span className="badge badge-warning">
        <AlertTriangle size={12} />
        {text || normStatus}
      </span>
    );
  }

  return (
    <span className="badge badge-blue">
      <Clock size={12} />
      {text || status || 'PENDING'}
    </span>
  );
};

export default CryptoBadge;
