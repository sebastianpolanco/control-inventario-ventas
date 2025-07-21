import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, Timestamp, deleteDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import Factura from '../components/Factura';
import EmailModal from '../components/EmailModal';
import ClienteForm from '../components/ClienteForm';
import Toast from '../components/Toast';
import { useReactToPrint } from 'react-to-print';
import { sendFacturaEmail } from '../utils/emailService';

const DEFAULT_PROFILE_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

// Lista de categorías de productos
const CATEGORIAS_PRODUCTOS = [
  'Postres',
  'Bebidas',
  'Ensaladas de frutas',
  'Helados',
  'Cholados y raspados',
  'Café',
  'Comida rápida',
  'Adiciones',
  'Sin categoría'
];

// Enhanced responsive utilities
const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

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

  return {
    isMobile: windowSize.width < 768,
    isTablet: windowSize.width >= 768 && windowSize.width < 1024,
    isDesktop: windowSize.width >= 1024,
    width: windowSize.width,
    height: windowSize.height
  };
};

// Add viewport helper functions
const isMobile = () => window.innerWidth < 768;
const isTablet = () => window.innerWidth >= 768 && window.innerWidth < 1024;
const getResponsiveSize = (mobileSize, tabletSize, desktopSize) => {
  if (isMobile()) return mobileSize;
  if (isTablet()) return tabletSize || desktopSize;
  return desktopSize;
};

const getResponsiveColumns = () => {
  if (isMobile()) return 'repeat(2, 1fr)';
  if (isTablet()) return 'repeat(3, 1fr)';
  return 'repeat(auto-fill, minmax(150px, 1fr))';
};

function DashboardVendedor() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState({
    nombre: '',
    rol: '',
    imagenURL: DEFAULT_PROFILE_IMAGE
  });
  const [productos, setProductos] = useState([]);
  const [ventaActual, setVentaActual] = useState({
    productos: [],
    total: 0,
    efectivo: '',
    cambio: 0,
    metodoPago: 'efectivo' // Add payment method
  });
  const [historialVentas, setHistorialVentas] = useState([]);
  const [seccionActiva, setSeccionActiva] = useState('panel');
  const [ventasDelDia, setVentasDelDia] = useState([]);
  const [totalDelDia, setTotalDelDia] = useState(0);
  const [topProductos, setTopProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [ventaParaFacturar, setVentaParaFacturar] = useState(null);
  const [mostrarPreviewFactura, setMostrarPreviewFactura] = useState(false);  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showClienteForm, setShowClienteForm] = useState(false);
  const [clienteData, setClienteData] = useState(null);
  const [ventasPendientes, setVentasPendientes] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [metodoPagoStats, setMetodoPagoStats] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    nequi: 0,
    daviplata: 0,
    otro: 0
  });
  const facturaRef = useRef();
  const ordenRef = useRef();
  const [ordenesEnProceso, setOrdenesEnProceso] = useState([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [mostrarPreviewOrden, setMostrarPreviewOrden] = useState(false);

  // Estado para los mensajes Toast
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'success'
  });

  // Función para mostrar mensajes
  const showToast = (message, type = 'success') => {
    setToast({
      visible: true,
      message,
      type
    });
  };

  // Función para cerrar el toast
  const closeToast = () => {
    setToast({ ...toast, visible: false });
  };

  // Cargar perfil de usuario
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (!userData) {
          navigate('/');
          return;
        }

        // Cargar perfil del vendedor
        const vendedorQuery = query(
          collection(db, "vendedores"), 
          where("username", "==", userData.username)
        );
        const vendedorSnapshot = await getDocs(vendedorQuery);
        
        if (!vendedorSnapshot.empty) {
          const vendedorData = vendedorSnapshot.docs[0].data();
          const validatedImageUrl = await validateAndLoadImage(vendedorData.imagenURL);
          
          setUserProfile({
            nombre: vendedorData.username,
            rol: vendedorData.rol,
            imagenURL: validatedImageUrl,
            sucursal: vendedorData.sucursal || 'No asignada'
          });
        }

        // Cargar productos del inventario
        const productosSnapshot = await getDocs(collection(db, "productos"));
        const productosData = productosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          cantidadVenta: 0, // Para control de cantidad en la venta
          categoria: doc.data().categoria || 'Sin categoría' // Asegurar que todos los productos tengan categoría
        }));
        setProductos(productosData);

        // Cargar ventas del día
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const ventasQuery = query(
          collection(db, "ventas"),
          where("fecha", ">=", hoy)
        ); // Removemos el filtro por vendedorId temporalmente para debug

        const ventasSnapshot = await getDocs(ventasQuery);
        const ventasData = ventasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          fecha: doc.data().fecha.toDate() // Convertir timestamp a Date
        }));

        console.log("Ventas cargadas:", ventasData); // Debug
        setHistorialVentas(ventasData);
        setVentasDelDia(ventasData);
        setTotalDelDia(ventasData.reduce((sum, v) => sum + v.total, 0));
        calcularTopProductos(ventasData);
        calcularEstadisticasPorMetodoPago(ventasData);

        // Load pending orders from waiters
        await cargarVentasPendientes();
        
        // Cargar órdenes en proceso de meseros
        await cargarOrdenesEnProceso();
      } catch (error) {
        console.error("Error detallado al cargar datos:", error);
      }
    };
    cargarDatos();
  }, [navigate]);

  const agregarProductoVenta = (producto) => {
    if (producto.cantidadVenta >= producto.cantidad) {
      showToast('No hay suficiente stock', 'warning');
      return;
    }

    const nuevosProductos = ventaActual.productos.find(p => p.id === producto.id)
      ? ventaActual.productos.map(p => 
          p.id === producto.id 
            ? { ...p, cantidadVenta: p.cantidadVenta + 1 }
            : p
        )
      : [...ventaActual.productos, { ...producto, cantidadVenta: 1 }];

    const nuevoTotal = nuevosProductos.reduce(
      (sum, p) => sum + (p.precio * p.cantidadVenta), 0
    );

    setVentaActual({
      ...ventaActual,
      productos: nuevosProductos,
      total: nuevoTotal,
      cambio: ventaActual.efectivo ? ventaActual.efectivo - nuevoTotal : 0
    });
  };

  const quitarProductoVenta = (productoId) => {
    const nuevosProductos = ventaActual.productos.filter(p => p.id !== productoId);
    const nuevoTotal = nuevosProductos.reduce(
      (sum, p) => sum + (p.precio * p.cantidadVenta), 0
    );

    setVentaActual({
      ...ventaActual,
      productos: nuevosProductos,
      total: nuevoTotal,
      cambio: ventaActual.efectivo ? ventaActual.efectivo - nuevoTotal : 0
    });
  };

  // Modificar la función de registro de venta
  const registrarVenta = async () => {
    try {
      if (!ventaActual.productos.length) {
        showToast('Por favor, agregue productos a la venta', 'warning');
        return;
      }

      if (ventaActual.metodoPago === 'efectivo' && 
          (!ventaActual.efectivo || ventaActual.efectivo < ventaActual.total)) {
        showToast('El efectivo recibido debe ser mayor o igual al total', 'error');
        return;
      }

      const userData = JSON.parse(localStorage.getItem('user'));
      const ventaData = {
        productos: ventaActual.productos,
        total: ventaActual.total,
        efectivo: parseFloat(ventaActual.efectivo || 0),
        cambio: ventaActual.cambio,
        metodoPago: ventaActual.metodoPago,
        fecha: Timestamp.now(), // Usar Timestamp en lugar de Date
        vendedorId: userData.id,
        vendedorNombre: userData.username,
        sucursal: userProfile.sucursal || 'No asignada'
      };

      // Registrar venta
      const docRef = await addDoc(collection(db, "ventas"), ventaData);
      
      // Set up invoice data
      setVentaParaFacturar({
        ...ventaData,
        id: docRef.id,
        fecha: new Date().toLocaleString()
      });
      setMostrarPreviewFactura(true);

      // Actualizar inventario
      for (const producto of ventaActual.productos) {
        await updateDoc(doc(db, "productos", producto.id), {
          cantidad: producto.cantidad - producto.cantidadVenta
        });
      }

      // Actualizar estado local
      setHistorialVentas([...historialVentas, { ...ventaData, id: docRef.id }]);
      setVentaActual({
        productos: [],
        total: 0,
        efectivo: '',
        cambio: 0,
        metodoPago: 'efectivo'
      });
      setVentasDelDia([...ventasDelDia, ventaData]);
      setTotalDelDia(totalDelDia + ventaData.total);

      showToast('Venta registrada exitosamente', 'success');
    } catch (error) {
      console.error("Error al registrar venta:", error);
      showToast(`Error al registrar la venta: ${error.message}`, 'error');
    }
  };

  const calcularCambio = (efectivo) => {
    const cambio = efectivo - ventaActual.total;
    setVentaActual({
      ...ventaActual,
      efectivo,
      cambio: cambio >= 0 ? cambio : 0
    });
  };

  // Función auxiliar para formatear fechas
  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    if (fecha instanceof Timestamp) {
      return fecha.toDate().toLocaleString();
    }
    if (fecha instanceof Date) {
      return fecha.toLocaleString();
    }
    return new Date(fecha).toLocaleString();
  };

  // Modificar esta función para ordenar por cantidad vendida, no por valor
  const calcularTopProductos = (ventas) => {
    const productosVendidos = {};
    
    ventas.forEach(venta => {
      venta.productos.forEach(prod => {
        if (productosVendidos[prod.id]) {
          productosVendidos[prod.id].cantidadTotal += prod.cantidadVenta;
          productosVendidos[prod.id].ventasTotal += (prod.precio * prod.cantidadVenta);
        } else {
          productosVendidos[prod.id] = {
            id: prod.id,
            nombre: prod.nombre,
            cantidadTotal: prod.cantidadVenta,
            ventasTotal: prod.precio * prod.cantidadVenta,
            imagenURL: prod.imagenURL
          };
        }
      });
    });

    // Ordenar por cantidadTotal en lugar de ventasTotal
    const topProductosArray = Object.values(productosVendidos)
      .sort((a, b) => b.cantidadTotal - a.cantidadTotal)
      .slice(0, 3);

    setTopProductos(topProductosArray);
  };

  // Añadir función para calcular estadísticas por método de pago
  const calcularEstadisticasPorMetodoPago = (ventas) => {
    const stats = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      nequi: 0,
      daviplata: 0,
      otro: 0
    };
    
    ventas.forEach(venta => {
      const metodoPago = venta.metodoPago ? venta.metodoPago.toLowerCase() : 'otro';
      
      if (stats.hasOwnProperty(metodoPago)) {
        stats[metodoPago] += venta.total;
      } else {
        stats.otro += venta.total;
      }
    });
    
    setMetodoPagoStats(stats);
  };

  const formatearNumero = (numero) => {
    return new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(numero);
  };

  const renderSeccion = () => {
    switch(seccionActiva) {
      case 'panel':
        return (
          <div style={{ padding: '10px' }}>
            <h2>Panel Principal</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile() ? '1fr' : 'repeat(3, 1fr)', 
              gap: '10px',
              marginBottom: '20px' 
            }}>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#28a745', 
                color: 'white', 
                borderRadius: '8px',
                textAlign: 'center' 
              }}>
                <h3>Ventas del Día</h3>
                <h2>${formatearNumero(totalDelDia)}</h2>
              </div>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                borderRadius: '8px',
                textAlign: 'center' 
              }}>
                <h3>Total de Ventas</h3>
                <h2>{formatearNumero(ventasDelDia.length)}</h2>
              </div>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#17a2b8', 
                color: 'white', 
                borderRadius: '8px',
                textAlign: 'center' 
              }}>
                <h3>Promedio por Venta</h3>
                <h2>${formatearNumero(ventasDelDia.length ? totalDelDia / ventasDelDia.length : 0)}</h2>
              </div>
            </div>

            {/* Ventas por Método de Pago */}
            <h3 style={{ marginTop: '20px', marginBottom: '15px' }}>Ventas por Método de Pago</h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: isMobile() ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <div style={{ 
                padding: '15px',
                backgroundColor: '#198754',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: isMobile() ? '14px' : '16px' }}>Efectivo</h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: isMobile() ? '1.2rem' : '1.5rem', 
                  fontWeight: 'bold' 
                }}>
                  ${formatearNumero(metodoPagoStats.efectivo)}
                </p>
              </div>
              
              <div style={{ 
                padding: '15px',
                backgroundColor: '#0d6efd',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: isMobile() ? '14px' : '16px' }}>Tarjeta</h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: isMobile() ? '1.2rem' : '1.5rem', 
                  fontWeight: 'bold' 
                }}>
                  ${formatearNumero(metodoPagoStats.tarjeta)}
                </p>
              </div>
              
              <div style={{ 
                padding: '15px',
                backgroundColor: '#6f42c1',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: isMobile() ? '14px' : '16px' }}>Transferencia</h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: isMobile() ? '1.2rem' : '1.5rem', 
                  fontWeight: 'bold' 
                }}>
                  ${formatearNumero(metodoPagoStats.transferencia)}
                </p>
              </div>
              
              <div style={{ 
                padding: '15px',
                backgroundColor: '#e83e8c',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: isMobile() ? '14px' : '16px' }}>Nequi</h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: isMobile() ? '1.2rem' : '1.5rem', 
                  fontWeight: 'bold' 
                }}>
                  ${formatearNumero(metodoPagoStats.nequi)}
                </p>
              </div>
              
              <div style={{ 
                padding: '15px',
                backgroundColor: '#fd7e14',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: isMobile() ? '14px' : '16px' }}>Daviplata</h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: isMobile() ? '1.2rem' : '1.5rem', 
                  fontWeight: 'bold' 
                }}>
                  ${formatearNumero(metodoPagoStats.daviplata)}
                </p>
              </div>
              
              <div style={{ 
                padding: '15px',
                backgroundColor: '#6c757d',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: isMobile() ? '14px' : '16px' }}>Otros</h4>
                <p style={{ 
                  margin: 0, 
                  fontSize: isMobile() ? '1.2rem' : '1.5rem', 
                  fontWeight: 'bold' 
                }}>
                  ${formatearNumero(metodoPagoStats.otro)}
                </p>
              </div>
            </div>

            {/* Top Productos Section - Changed to sort by quantity */}
            <h3 style={{ marginTop: '20px', marginBottom: '15px' }}>Top 3 Productos (Por Cantidad)</h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: isMobile() ? '1fr' : 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '20px'
            }}>
              {topProductos.map((producto, index) => (
                <div key={producto.id} style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '15px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                  {producto.imagenURL && (
                    <img 
                      src={producto.imagenURL}
                      alt={producto.nombre}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '8px'
                      }}
                    />
                  )}
                  <h4 style={{ margin: '0', textAlign: 'center' }}>{producto.nombre}</h4>
                  {/* Highlight cantidad rather than value */}
                  <p style={{ 
                    margin: '0',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#28a745'
                  }}>
                    Vendidos: {formatearNumero(producto.cantidadTotal)}
                  </p>
                  <p style={{ margin: '0', color: '#666' }}>
                    Total: ${formatearNumero(producto.ventasTotal)}
                  </p>
                </div>
              ))}
            </div>

            <h3>Últimas Ventas</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {ventasDelDia.slice(-5).reverse().map(venta => (
                <div key={venta.id} style={{ 
                  padding: '10px', 
                  border: '1px solid #dee2e6',
                  marginBottom: '10px',
                  borderRadius: '4px'
                }}>
                  <p>Total: ${formatearNumero(venta.total)}</p>
                  <p>
                    Método: <span style={{ 
                      display: 'inline-block',
                      padding: '2px 8px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      {venta.metodoPago?.charAt(0).toUpperCase() + venta.metodoPago?.slice(1) || 'Efectivo'}
                    </span>
                  </p>
                  <p>Hora: {formatearFecha(venta.fecha)}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'productos':
        // Filtrar productos por categoría y búsqueda
        const productosFiltrados = productos.filter(producto => {
          const coincideBusqueda = producto.nombre.toLowerCase().includes(busqueda.toLowerCase());
          const coincideCategoria = filtroCategoria === 'Todas' || producto.categoria === filtroCategoria;
          return coincideBusqueda && coincideCategoria;
        });

        // Agrupar productos por categoría si no hay filtro específico
        const productosPorCategoria = {};
        if (filtroCategoria === 'Todas') {
          CATEGORIAS_PRODUCTOS.forEach(cat => {
            productosPorCategoria[cat] = productosFiltrados.filter(
              p => p.categoria === cat
            );
          });
          
          // Añadir productos sin categoría al final
          const sinCategoria = productosFiltrados.filter(
            p => !CATEGORIAS_PRODUCTOS.includes(p.categoria)
          );
          if (sinCategoria.length > 0) {
            productosPorCategoria['Sin categoría'] = sinCategoria;
          }
        }

        return (
          <div style={{ 
            padding: isMobile() ? '5px' : '10px',
            display: 'flex', 
            flexDirection: isMobile() ? 'column' : 'row',
            gap: isMobile() ? '10px' : '15px' 
          }}>
            {/* Catálogo de productos */}
            <div style={{ flex: isMobile() ? 'none' : 2 }}>
              <div style={{ 
                marginBottom: '20px',
                display: 'flex',
                flexDirection: isMobile() ? 'column' : 'row',
                gap: '10px'
              }}>
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    flex: isMobile() ? 'none' : 1,
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px'
                  }}
                />
                
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  style={{
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa'
                  }}
                >
                  <option value="Todas">Todas las categorías</option>
                  {CATEGORIAS_PRODUCTOS.map((cat, index) => (
                    <option key={index} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <h2>Catálogo de Productos</h2>

              {filtroCategoria !== 'Todas' ? (
                // Vista de productos filtrados por una categoría específica
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile() 
                    ? 'repeat(auto-fill, minmax(100px, 1fr))' // Smaller cards on mobile
                    : 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: isMobile() ? '5px' : '10px' 
                }}>
                  {productosFiltrados.map(producto => (
                    <ProductoCard 
                      key={producto.id} 
                      producto={producto} 
                      agregarProductoVenta={agregarProductoVenta}
                      formatearNumero={formatearNumero}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              ) : (
                // Vista agrupada por categorías
                Object.keys(productosPorCategoria).map(categoria => 
                  productosPorCategoria[categoria].length > 0 && (
                    <div key={categoria} style={{ marginBottom: '30px' }}>
                      <h3 style={{ 
                        borderBottom: '2px solid #007bff', 
                        paddingBottom: '8px',
                        marginBottom: '15px'
                      }}>
                        {categoria}
                      </h3>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: isMobile() 
                          ? 'repeat(auto-fill, minmax(100px, 1fr))'
                          : 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: isMobile() ? '5px' : '10px' 
                      }}>
                        {productosPorCategoria[categoria].map(producto => (
                          <ProductoCard 
                            key={producto.id} 
                            producto={producto} 
                            agregarProductoVenta={agregarProductoVenta}
                            formatearNumero={formatearNumero}
                            isMobile={isMobile}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            {/* Panel de venta actual */}
            <div style={{ 
              width: isMobile() ? '100%' : 'auto',
              position: isMobile() ? 'fixed' : 'sticky',
              bottom: isMobile() ? '0' : 'auto',
              left: isMobile() ? '0' : 'auto',
              backgroundColor: 'white',
              padding: '15px',
              boxShadow: '0 -2px 4px rgba(0,0,0,0.1)',
              zIndex: 1000
            }}>
              <h3>Venta Actual</h3>
              {ventaActual.productos.length === 0 ? (
                <p>No hay productos en la venta actual</p>
              ) : (
                <>
                  {ventaActual.productos.map(producto => (
                    <div key={producto.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid #eee'
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0', fontWeight: 'bold' }}>{producto.nombre}</p>
                        <p style={{ margin: '0' }}>
                          ${formatearNumero(producto.precio)} x {producto.cantidadVenta}
                        </p>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span>${formatearNumero(producto.precio * producto.cantidadVenta)}</span>
                        <button
                          onClick={() => quitarProductoVenta(producto.id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✖
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: '20px' }}>
                    <h4>Total: ${formatearNumero(ventaActual.total)}</h4>
                    
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px' }}>Método de Pago:</label>
                      <select
                        value={ventaActual.metodoPago}
                        onChange={(e) => setVentaActual({ ...ventaActual, metodoPago: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px',
                          marginBottom: '10px',
                          borderRadius: '4px',
                          border: '1px solid #ddd'
                        }}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="nequi">Nequi</option>
                        <option value="daviplata">Daviplata</option>
                      </select>
                    </div>

                    {ventaActual.metodoPago === 'efectivo' && (
                      <>
                        <input
                          type="number"
                          placeholder="Efectivo recibido"
                          value={ventaActual.efectivo}
                          onChange={(e) => calcularCambio(parseFloat(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '8px',
                            marginBottom: '10px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}
                        />
                        <p>Cambio: ${formatearNumero(ventaActual.cambio)}</p>
                      </>
                    )}

                    <button
                      onClick={registrarVenta}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Finalizar Venta
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 'ventas':
        return (
          <div style={{ padding: '20px' }}>
            <h2>Historial de Ventas</h2>
            {historialVentas.length === 0 ? (
              <p>No hay ventas registradas</p>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {[...historialVentas].reverse().map(venta => (
                  <div key={venta.id} style={{ 
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '15px',
                    backgroundColor: '#fff'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h4>#{venta.id.slice(-4).replace(/[^0-9]/g, '').padStart(4, '0')}</h4>
                      <p>{formatearFecha(venta.fecha)}</p>
                    </div>
                    {venta.productos && venta.productos.map(prod => (
                      <div key={prod.id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '5px 0',
                        borderBottom: '1px solid #eee'
                      }}>
                        <span>{prod.nombre} x {prod.cantidadVenta}</span>
                        <span>${formatearNumero(prod.precio * prod.cantidadVenta)}</span>
                      </div>
                    ))}
                    <div style={{ 
                      marginTop: '10px',
                      padding: '10px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px'
                    }}>
                      <p><strong>Total:</strong> ${formatearNumero(venta.total)}</p>
                      <p>
                        <strong>Método de Pago:</strong>{' '}
                        <span style={{
                          backgroundColor: '#007bff',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.9em'
                        }}>
                          {venta.metodoPago?.charAt(0).toUpperCase() + venta.metodoPago?.slice(1) || 'Efectivo'}
                        </span>
                      </p>
                      {venta.metodoPago === 'efectivo' && (
                        <>
                          <p><strong>Efectivo:</strong> ${formatearNumero(venta.efectivo)}</p>
                          <p><strong>Cambio:</strong> ${formatearNumero(venta.cambio)}</p>
                        </>
                      )}
                      {venta.mesero ? (
                        <>
                          <p><strong>Mesero:</strong> {venta.mesero}</p>
                          <p><strong>Procesado por:</strong> {venta.vendedorNombre}</p>
                          {venta.mesa && <p><strong>Mesa:</strong> {venta.mesa}</p>}
                        </>
                      ) : (
                        <p><strong>Vendedor:</strong> {venta.vendedorNombre}</p>
                      )}
                      {venta.sucursal && <p><strong>Sucursal:</strong> {venta.sucursal}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'ordenes_meseros':
        return (
          <div style={{ padding: '20px' }}>
            <h2>🍽️ Órdenes de Meseros</h2>
            {ventasPendientes.length === 0 ? (
              <p>No hay órdenes pendientes de meseros</p>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {ventasPendientes.map(venta => (
                  <div key={venta.id} style={{ 
                    border: '1px solid #ffc107',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '15px',
                    backgroundColor: '#fff9c4'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h4>Mesa {venta.mesa}</h4>
                      <div>
                        <span style={{ marginRight: '10px' }}>Mesero: {venta.mesero}</span>
                        <span>{new Date(venta.fecha.seconds * 1000).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    {venta.productos && venta.productos.map(prod => (
                      <div key={prod.id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '5px 0',
                        borderBottom: '1px solid #eee'
                      }}>
                        <span>{prod.nombre} x {prod.cantidadVenta}</span>
                        <span>${formatearNumero(prod.precio * prod.cantidadVenta)}</span>
                      </div>
                    ))}
                    
                    <div style={{ 
                      marginTop: '10px',
                      padding: '10px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <p style={{ margin: 0 }}><strong>Total: ${formatearNumero(venta.total)}</strong></p>
                      </div>
                      <button
                        onClick={() => procesarOrdenMesero(venta)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        💳 Procesar Cobro
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'ordenes_proceso':
        return (
          <div style={{ padding: '20px' }}>
            <h2>🔄 Órdenes en Proceso</h2>
            {ordenesEnProceso.length === 0 ? (
              <p>No hay órdenes en proceso</p>
            ) : (
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: isMobile() ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '15px',
                marginTop: '20px'
              }}>
                {ordenesEnProceso.map(orden => (
                  <div key={orden.id} style={{
                    border: orden.estado === 'lista_para_cobrar' 
                      ? '1px solid #28a745' 
                      : '1px solid #ffc107',
                    borderRadius: '12px',
                    padding: '15px',
                    backgroundColor: orden.estado === 'lista_para_cobrar' 
                      ? '#f8fff8'
                      : '#fff9e6',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Cabecera de la tarjeta */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '15px',
                      borderBottom: orden.estado === 'lista_para_cobrar' 
                        ? '1px solid #e6f5e6'
                        : '1px solid #fff3cd',
                      paddingBottom: '10px'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        color: orden.estado === 'lista_para_cobrar' ? '#28a745' : '#ffc107'
                      }}>
                        <span style={{ 
                          backgroundColor: orden.estado === 'lista_para_cobrar' ? '#28a745' : '#ffc107', 
                          color: orden.estado === 'lista_para_cobrar' ? 'white' : 'black', 
                          width: '24px', 
                          height: '24px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}>
                          {orden.mesa}
                        </span>
                        <h4 style={{ margin: 0 }}>Mesa {orden.mesa}</h4>
                      </div>
                      <div style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end'
                      }}>
                        <span style={{ 
                          backgroundColor: orden.estado === 'lista_para_cobrar' ? '#28a745' : '#ffc107',
                          color: orden.estado === 'lista_para_cobrar' ? 'white' : 'black',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          marginBottom: '5px'
                        }}>
                          {orden.estado === 'lista_para_cobrar' ? 'Lista para cobrar' : 'En preparación'}
                        </span>
                        <span style={{ 
                          color: '#666',
                          fontSize: '12px'
                        }}>
                          {orden.fecha?.seconds ? new Date(orden.fecha.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                      </div>
                    </div>
                    
                    {/* Lista de productos */}
                    <div style={{ 
                      flex: 1,
                      marginBottom: '15px'
                    }}>
                      {orden.productos.map((prod, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          fontSize: '14px',
                          padding: '8px 0',
                          borderBottom: index < orden.productos.length - 1 ? '1px dashed #eee' : 'none'
                        }}>
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <span style={{
                              backgroundColor: orden.estado === 'lista_para_cobrar' ? '#e8f5e8' : '#fff3cd',
                              color: orden.estado === 'lista_para_cobrar' ? '#28a745' : '#ffc107',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {prod.cantidadOrden}
                            </span>
                            <span style={{ fontWeight: '500' }}>{prod.nombre}</span>
                          </div>
                          <span style={{ 
                            color: orden.estado === 'lista_para_cobrar' ? '#28a745' : '#ffc107',
                            fontWeight: '600'
                          }}>
                            ${formatearNumero(prod.precio * prod.cantidadOrden)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Notas */}
                    {orden.notas && (
                      <div style={{ 
                        marginBottom: '15px',
                        padding: '10px',
                        backgroundColor: orden.estado === 'lista_para_cobrar' ? '#e8f5e8' : '#fff3cd',
                        borderRadius: '8px',
                        fontSize: '14px',
                        borderLeft: orden.estado === 'lista_para_cobrar' 
                          ? '3px solid #28a745' 
                          : '3px solid #ffc107'
                      }}>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          marginBottom: '5px',
                          color: orden.estado === 'lista_para_cobrar' ? '#28a745' : '#ffc107',
                          fontWeight: '600'
                        }}>
                          <span>📝</span>
                          <span>Notas:</span>
                        </div>
                        <div style={{ 
                          paddingLeft: '20px', 
                          color: orden.estado === 'lista_para_cobrar' ? '#495057' : '#856404'
                        }}>
                          {orden.notas}
                        </div>
                      </div>
                    )}

                    {/* Footer con total y acciones */}
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: orden.estado === 'lista_para_cobrar' 
                        ? '1px solid #e6f5e6' 
                        : '1px solid #fff3cd',
                      paddingTop: '15px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ 
                        backgroundColor: orden.estado === 'lista_para_cobrar' ? '#e8f5e8' : '#fff3cd',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        color: '#212529'
                      }}>
                        Total: <span style={{ 
                          color: orden.estado === 'lista_para_cobrar' ? '#28a745' : '#ffc107'
                        }}>
                          ${formatearNumero(orden.total)}
                        </span>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => imprimirOrden(orden)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: getResponsiveSize('12px', '13px', '14px'),
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span>🖨️</span>
                          <span>Imprimir</span>
                        </button>
                        {orden.estado === 'lista_para_cobrar' && (
                          <button
                            onClick={() => procesarOrdenMesero({
                              ...orden,
                              productos: orden.productos.map(p => ({
                                ...p,
                                cantidadVenta: p.cantidadOrden
                              }))
                            })}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: getResponsiveSize('12px', '13px', '14px'),
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <span>💳</span>
                            <span>Procesar Cobro</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Componente de tarjeta de producto (para evitar repetición de código)
  const ProductoCard = ({ producto, agregarProductoVenta, formatearNumero, isMobile }) => (
    <div style={{ 
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: isMobile() ? '8px' : '10px',
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      minHeight: isMobile() ? '200px' : '250px'
    }}>
      {producto.imagenURL && (
        <img 
          src={producto.imagenURL} 
          alt={producto.nombre}
          style={{ 
            width: '100%', 
            height: '100px',
            objectFit: 'cover', 
            borderRadius: '4px',
            marginBottom: '8px'
          }}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ 
          margin: '0 0 5px 0',
          fontSize: '14px',
          minHeight: 'auto',
          overflow: 'visible',
          wordBreak: 'break-word'
        }}>{producto.nombre}</h4>
        <p style={{ margin: '5px 0', fontSize: '13px' }}>Precio: ${formatearNumero(producto.precio)}</p>
        <p style={{ margin: '5px 0', fontSize: '13px' }}>Stock: {formatearNumero(producto.cantidad)}</p>
        
        {/* Mostrar categoría */}
        {producto.categoria && (
          <span style={{
            display: 'inline-block',
            padding: '2px 6px',
            backgroundColor: '#e9ecef',
            borderRadius: '12px',
            fontSize: '10px',
            marginBottom: '5px'
          }}>
            {producto.categoria}
          </span>
        )}
        
        <div style={{ marginTop: 'auto' }}> {/* Push button to bottom */}
          <button 
            onClick={() => agregarProductoVenta(producto)}
            disabled={producto.cantidad <= 0}
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: producto.cantidad > 0 ? '#28a745' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: producto.cantidad > 0 ? 'pointer' : 'not-allowed',
              fontSize: '13px'
            }}
          >
            {producto.cantidad > 0 ? 'Agregar a Venta' : 'Sin Stock'}
          </button>
        </div>
      </div>
    </div>
  );

  // Add this function to preload and validate image URL
  const validateAndLoadImage = async (url) => {
    if (!url) return DEFAULT_PROFILE_IMAGE;
    
    try {
      // Check if it's a valid URL
      new URL(url);
      
      // Try to load the image
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(DEFAULT_PROFILE_IMAGE);
        img.src = url;
      });
    } catch {
      return DEFAULT_PROFILE_IMAGE;
    }
  };

  // Add error handling function for images
  const handleImageError = (e) => {
    e.target.onerror = null; // Prevent infinite loop
    e.target.src = DEFAULT_PROFILE_IMAGE;
  };

  // Modificar handlePrintFactura
  const handlePrintFactura = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Factura</title>
          <style>
            @media print {
              body {
                width: 80mm;
                margin: 0;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          ${facturaRef.current.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleEmailClick = () => {
    setShowClienteForm(true);
  };

  const handleClienteSubmit = (cliente) => {
    setClienteData(cliente);
    setShowClienteForm(false);
    setShowEmailModal(true);
  };

  const handleSendEmail = async (email) => {
    try {
      await sendFacturaEmail({
        email,
        facturaId: ventaParaFacturar.id,
        total: ventaParaFacturar.total,
        fecha: ventaParaFacturar.fecha,
        productos: ventaParaFacturar.productos,
        vendedor: ventaParaFacturar.vendedorNombre,
        cliente: clienteData,
        metodoPago: ventaParaFacturar.metodoPago
      });
      
      showToast('Factura enviada exitosamente al correo: ' + email, 'success');
      setShowEmailModal(false);
      setClienteData(null);
    } catch (error) {
      console.error('Error al enviar email:', error);
      showToast(`Error al enviar email: ${error.message}`, 'error');
    }
  };

  // Add function to load pending orders from waiters
  const cargarVentasPendientes = async () => {
    try {
      const ventasPendientesSnapshot = await getDocs(collection(db, "ventas_pendientes"));
      const ventasPendientesData = ventasPendientesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVentasPendientes(ventasPendientesData);
    } catch (error) {
      console.error("Error al cargar ventas pendientes:", error);
    }
  };
  // Add function to process waiter order
  const procesarOrdenMesero = async (ventaPendiente) => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      
      // Convert to regular sale
      const ventaData = {
        productos: ventaPendiente.productos,
        total: ventaPendiente.total,
        efectivo: 0,
        cambio: 0,
        metodoPago: 'efectivo',
        fecha: Timestamp.now(),
        vendedorId: userData.id,
        vendedorNombre: userData.username,
        mesa: ventaPendiente.mesa,
        mesero: ventaPendiente.mesero,
        sucursal: ventaPendiente.sucursal || userProfile.sucursal || 'No asignada'
      };

      // Set up for regular sale process
      setVentaActual(ventaData);
      setSeccionActiva('productos');
      
      // Remove from pending orders
      await deleteDoc(doc(db, "ventas_pendientes", ventaPendiente.id));
      
      // Reload pending orders
      await cargarVentasPendientes();
      
      showToast(`Orden de Mesa ${ventaPendiente.mesa} agregada para cobro`, 'info');
    } catch (error) {
      console.error("Error al procesar orden:", error);
      showToast('Error al procesar la orden', 'error');
    }
  };

  // Añadir función para cargar órdenes en proceso de meseros
  const cargarOrdenesEnProceso = async () => {
    try {
      const ordenesQuery = query(
        collection(db, "ordenes"),
        where("estado", "in", ["en_proceso", "lista_para_cobrar"])
      );
      const ordenesSnapshot = await getDocs(ordenesQuery);
      const ordenesData = ordenesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setOrdenesEnProceso(ordenesData);
    } catch (error) {
      console.error("Error al cargar órdenes en proceso:", error);
      showToast('Error al cargar órdenes en proceso', 'error');
    }
  };

  // Añadir función para imprimir orden
  const imprimirOrden = (orden) => {
    setOrdenSeleccionada(orden);
    setMostrarPreviewOrden(true);
  };

  // Función para imprimir la orden seleccionada
  const handlePrintOrden = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Orden - Mesa ${ordenSeleccionada.mesa}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              width: 80mm;
              margin: 0 auto;
            }
            h1, h2, h3, h4 {
              margin: 5px 0;
              text-align: center;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
            }
            .item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              border-bottom: 1px dashed #eee;
              padding-bottom: 5px;
            }
            .total {
              font-weight: bold;
              text-align: right;
              margin-top: 10px;
              font-size: 1.2em;
            }
            .notas {
              margin-top: 15px;
              padding: 10px;
              background-color: #f5f5f5;
              border-radius: 5px;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 0.8em;
            }
            @media print {
              body {
                width: 80mm;
                margin: 0;
                padding: 5mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>ORDEN</h3>
            <h4>Mesa ${ordenSeleccionada.mesa}</h4>
            <p>Mesero: ${ordenSeleccionada.mesero}</p>
            <p>Fecha: ${ordenSeleccionada.fecha?.seconds ? new Date(ordenSeleccionada.fecha.seconds * 1000).toLocaleString() : ''}</p>
          </div>
          
          <div>
            ${ordenSeleccionada.productos.map(prod => `
              <div class="item">
                <span>${prod.cantidadOrden} x ${prod.nombre}</span>
                <span>$${formatearNumero(prod.precio * prod.cantidadOrden)}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="total">
            Total: $${formatearNumero(ordenSeleccionada.total)}
          </div>
          
          ${ordenSeleccionada.notas ? `
            <div class="notas">
              <strong>Notas:</strong><br>
              ${ordenSeleccionada.notas}
            </div>
          ` : ''}
          
          <div class="footer">
            ${ordenSeleccionada.estado === 'en_proceso' ? 'EN PREPARACIÓN' : 'LISTA PARA COBRAR'}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <>
      {/* Toast notifications */}
      {toast.visible && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={closeToast} 
          duration={3000} 
        />
      )}

      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontSize: isMobile() ? '14px' : '16px' // Base font size adjustment
      }}>
        {/* Barra superior móvil */}
        {isMobile() && (
          <div style={{
            padding: '8px', // Reduced from 10px
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #dee2e6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 1000
          }}>
            <button
              onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
              style={{
                padding: '6px', // Reduced from 8px
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '20px' // Reduced from 24px
              }}
            >
              ☰
            </button>
            <h3 style={{ margin: 0, fontSize: '16px' }}>{userProfile.nombre}</h3>
          </div>
        )}

        {/* Barra lateral (responsive) */}
        <div style={{ 
          width: isMobile() ? '80%' : '250px',
          height: '100vh',
          backgroundColor: '#f8f9fa',
          borderRight: '1px solid #dee2e6',
          position: 'fixed',
          left: isMobile() ? (menuMovilAbierto ? '0' : '-80%') : '0',
          top: 0,
          transition: 'left 0.3s ease',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Area fija superior - perfil */}
          <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #dee2e6'
          }}>
            {/* Perfil del vendedor */}
            <div style={{
              padding: '15px',
              backgroundColor: 'white',
              borderRadius: '10px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <div style={{ 
                width: '80px',
                height: '80px',
                margin: '0 auto 15px auto',
                position: 'relative'
              }}>
                <img 
                  src={userProfile.imagenURL}
                  alt={userProfile.nombre}
                  onError={handleImageError}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #007bff',
                    backgroundColor: '#f8f9fa' // Add background color while loading
                  }}
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ 
                  margin: '0',
                  fontSize: '1.1rem',
                  color: '#2c3e50'
                }}>
                  {userProfile.nombre}
                </h3>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  marginTop: '5px'
                }}>
                  {userProfile.rol}
                </span>
                {userProfile.sucursal && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '0.85rem',
                    color: '#6c757d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}>
                    <span>📍</span>
                    <span>{userProfile.sucursal}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Area navegación con scroll si es necesario */}
          <nav style={{
            padding: '20px',
            flex: 1,
            overflowY: 'auto'
          }}>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '10px' }}>
                <button 
                  onClick={() => setSeccionActiva('panel')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: seccionActiva === 'panel' ? '#007bff' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  📊 Panel Principal
                </button>
              </li>
              <li style={{ marginBottom: '10px' }}>
                <button 
                  onClick={() => setSeccionActiva('productos')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: seccionActiva === 'productos' ? '#28a745' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  📦 Productos
                </button>
              </li>
              <li style={{ marginBottom: '10px' }}>
                <button 
                  onClick={() => setSeccionActiva('ventas')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: seccionActiva === 'ventas' ? '#17a2b8' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  📋 Historial de Ventas
                </button>
              </li>
              {/* Nueva opción en el menú */}
              <li style={{ marginBottom: '10px' }}>
                <button 
                  onClick={() => {
                    setSeccionActiva('ordenes_proceso');
                    cargarOrdenesEnProceso(); // Recargar al cambiar a esta sección
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: seccionActiva === 'ordenes_proceso' ? '#9c27b0' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>🔄 Órdenes en Proceso</span>
                  {ordenesEnProceso.length > 0 && (
                    <span style={{
                      backgroundColor: 'white',
                      color: '#9c27b0',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {ordenesEnProceso.length}
                    </span>
                  )}
                </button>
              </li>
              <li style={{ marginBottom: '10px' }}>
                <button 
                  onClick={() => setSeccionActiva('ordenes_meseros')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: seccionActiva === 'ordenes_meseros' ? '#ffc107' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🍽️ Órdenes de Meseros
                </button>
              </li>
            </ul>
          </nav>

          {/* Area fija inferior - botón cerrar sesión */}
          <div style={{
            padding: '20px',
            borderTop: '1px solid #dee2e6',
            backgroundColor: '#f8f9fa'
          }}>
            <button
              onClick={() => {
                localStorage.removeItem('user');
                navigate('/');
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
            >
              <span>🚪</span>
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Overlay para móvil */}
        {isMobile() && menuMovilAbierto && (
          <div
            onClick={() => setMenuMovilAbierto(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 1000
            }}
          />
        )}

        {/* Contenido principal */}
        <div style={{ 
          flex: 1,
          marginLeft: isMobile() ? '0' : '250px',
          padding: isMobile() ? '8px' : '40px',
          height: '100vh',
          overflowY: 'auto',
          paddingBottom: isMobile() ? '60px' : '40px'
        }}>
          <div style={{ 
            maxWidth: '1400px',
            margin: '0 auto',
            width: '100%',
            paddingLeft: isMobile() ? '10px' : '40px',
            paddingRight: isMobile() ? '10px' : '40px'
          }}>
            {renderSeccion()}
          </div>
        </div>
      </div>

      {/* Reemplazar el div oculto de la factura con este modal */}
      {mostrarPreviewFactura && ventaParaFacturar && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '400px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'white',
              padding: '10px',
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              borderBottom: '1px solid #dee2e6',
              marginBottom: '20px'
            }}>
              <button
                onClick={handleEmailClick}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                📧 Enviar por Email
              </button>
              <button
                onClick={handlePrintFactura}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => setMostrarPreviewFactura(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✖ Cerrar
              </button>
            </div>
            
            <div ref={facturaRef}>
              <Factura
                venta={ventaParaFacturar}
                fecha={ventaParaFacturar.fecha}
                tipo="thermal"
                cliente={clienteData}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de datos del cliente */}
      {showClienteForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2100
        }}>
          <ClienteForm
            onSubmit={handleClienteSubmit}
            onCancel={() => setShowClienteForm(false)}
          />
        </div>
      )}

      <EmailModal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setClienteData(null);
        }}
        onSend={handleSendEmail}
        initialEmail={clienteData?.email || ''}
      />

      {/* Modal para previsualización de orden */}
      {mostrarPreviewOrden && ordenSeleccionada && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '400px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'white',
              padding: '10px',
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              borderBottom: '1px solid #dee2e6',
              marginBottom: '20px'
            }}>
              <button
                onClick={handlePrintOrden}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={() => setMostrarPreviewOrden(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✖ Cerrar
              </button>
            </div>
            
            <div ref={ordenRef} style={{
              fontFamily: 'Arial, sans-serif',
              padding: '10px',
              maxWidth: '300px',
              margin: '0 auto'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: '5px 0' }}>ORDEN</h3>
                <h4 style={{ margin: '5px 0' }}>Mesa {ordenSeleccionada.mesa}</h4>
                <p style={{ margin: '5px 0' }}>Mesero: {ordenSeleccionada.mesero}</p>
                <p style={{ margin: '5px 0' }}>
                  Fecha: {ordenSeleccionada.fecha?.seconds ? new Date(ordenSeleccionada.fecha.seconds * 1000).toLocaleString() : ''}
                </p>
              </div>
              
              <div>
                {ordenSeleccionada.productos.map((prod, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '5px',
                    borderBottom: '1px dashed #eee',
                    paddingBottom: '5px'
                  }}>
                    <span>{prod.cantidadOrden} x {prod.nombre}</span>
                    <span>${formatearNumero(prod.precio * prod.cantidadOrden)}</span>
                  </div>
                ))}
              </div>
              
              <div style={{ 
                fontWeight: 'bold', 
                textAlign: 'right', 
                marginTop: '10px',
                fontSize: '1.2em'
              }}>
                Total: ${formatearNumero(ordenSeleccionada.total)}
              </div>
              
              {ordenSeleccionada.notas && (
                <div style={{
                  marginTop: '15px',
                  padding: '10px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '5px'
                }}>
                  <strong>Notas:</strong><br />
                  {ordenSeleccionada.notas}
                </div>
              )}
              
              <div style={{
                marginTop: '20px',
                textAlign: 'center',
                fontSize: '0.8em'
              }}>
                {ordenSeleccionada.estado === 'en_proceso' ? 'EN PREPARACIÓN' : 'LISTA PARA COBRAR'}
              </div>
            </div>
          </div>
        </div>  
      )}
    </>
  );
}

export default DashboardVendedor;
