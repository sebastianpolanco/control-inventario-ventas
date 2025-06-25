import React, { useState } from 'react';

const ClienteForm = ({ onSubmit, onCancel }) => {
  const [cliente, setCliente] = useState({
    nombre: '',
    identificacion: '',
    direccion: '',
    email: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cliente.nombre || !cliente.identificacion || !cliente.email) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }
    onSubmit(cliente);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '500px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ marginBottom: '20px', textAlign: 'center' }}>Datos del Cliente</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Nombre o Razón Social * 
          </label>
          <input
            type="text"
            value={cliente.nombre}
            onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '16px'
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Número de Identificación *
          </label>
          <input
            type="text"
            value={cliente.identificacion}
            onChange={(e) => setCliente({ ...cliente, identificacion: e.target.value })}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '16px'
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Dirección *
          </label>
          <input
            type="text"
            value={cliente.direccion}
            onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '16px'
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Correo Electrónico *
          </label>
          <input
            type="email"
            value={cliente.email}
            onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '16px'
            }}
            required
          />
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'center',
          marginTop: '30px' 
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '12px 24px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              minWidth: '120px'
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              minWidth: '120px'
            }}
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClienteForm;
