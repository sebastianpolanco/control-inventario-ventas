import React from 'react';

// Datos del negocio - puedes moverlos a un archivo de configuración
const BUSINESS_INFO = {
  nombre: "Kardhamo",
  nit: "123456789-0",
  direccion: "Calle Principal #123, Popayan, Colombia",
  email: "Kardhamo@minegocio.com",
  telefono: "(+57) 123 456 7890",
  logo: "/logo.png" // Asegúrate de tener el logo en la carpeta public
};

const Factura = React.forwardRef(({ venta, fecha, cliente }, ref) => {
  const formatearNumero = (numero) => {
    return new Intl.NumberFormat('es-CO').format(numero || 0);
  };

  // Add this function for formatting invoice number
  const formatearNumeroFactura = (id) => {
    return String(id).replace(/\D/g, '').padStart(4, '0');
  };

  return (
    <div ref={ref} style={{ 
      width: '80mm',
      padding: '5mm',
      backgroundColor: 'white',
      fontSize: '12px',
      fontFamily: 'monospace',
      margin: '0 auto',
      pageBreakAfter: 'always',
      printColorAdjust: 'exact'
    }}>
      {/* Header con logo */}
      <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '1px dashed #000', paddingBottom: '10px' }}>
        <img 
          src={BUSINESS_INFO.logo}
          alt="Logo"
          style={{
            width: '100px',
            height: 'auto',
            marginBottom: '10px',
            objectFit: 'contain'
          }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
        <h2 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{BUSINESS_INFO.nombre}</h2>
        <p style={{ margin: '3px 0', fontSize: '12px' }}>NIT: {BUSINESS_INFO.nit}</p>
        <p style={{ margin: '3px 0', fontSize: '12px' }}>{BUSINESS_INFO.direccion}</p>
        <p style={{ margin: '3px 0', fontSize: '12px' }}>Email: {BUSINESS_INFO.email}</p>
        <p style={{ margin: '3px 0', fontSize: '12px' }}>Tel: {BUSINESS_INFO.telefono}</p>
      </div>

      {/* Información de la factura */}
      <div style={{ marginBottom: '15px' }}>
        <p style={{ margin: '3px 0' }}><strong>Factura #:</strong> {formatearNumeroFactura(venta.id)}</p>
        <p style={{ margin: '3px 0' }}><strong>Fecha:</strong> {fecha}</p>
        <p style={{ margin: '3px 0' }}><strong>Vendedor:</strong> {venta.vendedorNombre}</p>
      </div>

      {cliente && (
        <div style={{ marginBottom: '10px' }}>
          <hr style={{ border: '1px dashed #000' }} />
          <h3 style={{ margin: '5px 0' }}>DATOS DEL CLIENTE</h3>
          <p style={{ margin: '2px 0' }}>Nombre: {cliente.nombre}</p>
          {cliente.identificacion && (
            <p style={{ margin: '2px 0' }}>ID: {cliente.identificacion}</p>
          )}
          {cliente.direccion && (
            <p style={{ margin: '2px 0' }}>Dir: {cliente.direccion}</p>
          )}
          {cliente.email && (
            <p style={{ margin: '2px 0' }}>Email: {cliente.email}</p>
          )}
          <hr style={{ border: '1px dashed #000' }} />
        </div>
      )}

      <div style={{ 
        borderTop: '1px dashed #000',
        borderBottom: '1px dashed #000',
        padding: '5px 0',
        marginBottom: '10px'
      }}>
        {venta.productos.map((producto, index) => (
          <div key={index} style={{ marginBottom: '5px' }}>
            <div>{producto.nombre}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{producto.cantidadVenta} x ${formatearNumero(producto.precio)}</span>
              <span>${formatearNumero(producto.precio * producto.cantidadVenta)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Total:</strong>
          <span>${formatearNumero(venta.total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Método de Pago:</strong>
          <span>{venta.metodoPago?.charAt(0).toUpperCase() + venta.metodoPago?.slice(1)}</span>
        </div>
        {venta.metodoPago === 'efectivo' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Efectivo:</strong>
              <span>${formatearNumero(venta.efectivo)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Cambio:</strong>
              <span>${formatearNumero(venta.cambio)}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <p>¡Gracias por su compra!</p>
        <small>Esta factura es un documento válido para efectos fiscales</small>
        {cliente?.email && (
          <p style={{ fontSize: '10px', marginTop: '5px' }}>
            Se enviará copia digital al correo: {cliente.email}
          </p>
        )}
      </div>
    </div>
  );
});

export default Factura;
