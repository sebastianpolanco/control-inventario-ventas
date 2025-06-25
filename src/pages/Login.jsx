import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowSize.width < 768;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Buscar usuario en Firestore
      const usersRef = collection(db, 'vendedores');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Usuario no encontrado');
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      if (userData.password === password) {
        // Guardar información del usuario
        localStorage.setItem('user', JSON.stringify({
          id: userDoc.id,
          username: userData.username,
          rol: userData.rol
        }));

        // Redireccionar según el rol
        if (userData.rol === 'admin') {
          navigate('/admin');
        } else if (userData.rol === 'vendedor') {
          navigate('/vendedor');
        } else if (userData.rol === 'mesero') {
          navigate('/mesero');
        } else {
          navigate('/vendedor'); // Redirección por defecto
        }
      } else {
        setError('Contraseña incorrecta');
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '30px',
          color: '#2c3e50',
          fontSize: '24px'
        }}>
          🏪 Sistema de Gestión
        </h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ 
              color: '#666',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Usuario:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.3s',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ 
              color: '#666',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Contraseña:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.3s',
              }}
            />
          </div>
          
          {loading && (
            <p style={{ 
              textAlign: 'center', 
              color: '#666',
              margin: '10px 0'
            }}>
              Cargando...
            </p>
          )}
          
          {error && (
            <p style={{ 
              color: '#e74c3c',
              textAlign: 'center',
              margin: '10px 0',
              padding: '10px',
              backgroundColor: '#fdeaea',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {error}
            </p>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '12px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              opacity: loading ? 0.7 : 1,
              ':hover': {
                backgroundColor: '#0056b3'
              }
            }}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
