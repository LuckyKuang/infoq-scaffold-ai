import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export default function RedirectPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    const target = params['*'] || '/index';
    navigate(`/${target}${location.search}`, { replace: true });
  }, [location.search, navigate, params]);

  return null;
}
