import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';

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
  return 'repeat(auto-fill, minmax(180px, 1fr))';
};

function DashboardMesero() {
  const navigate = useNavigate();
  
  // Estados principales
  const [userProfile, setUserProfile] = useState({
    nombre: '',
    rol: '',
    imagenURL: DEFAULT_PROFILE_IMAGE
  });
  const [seccionActiva, setSeccionActiva] = useState('panel');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  
  // Estados para productos y mesas
  const [productos, setProductos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  
  // Estados para órdenes
  const [ordenActual, setOrdenActual] = useState({
    productos: [],
    mesa: '',
    total: 0,
    notas: ''
  });
  const [ordenesEnProceso, setOrdenesEnProceso] = useState([]);
  const [ordenesParaCobrar, setOrdenesParaCobrar] = useState([]);
    // Estados para modales
  const [editandoOrden, setEditandoOrden] = useState(null);
  const [mostrarPanelOrden, setMostrarPanelOrden] = useState(false);

  // Funciones utilitarias
  const formatearNumero = (numero) => {
    return new Intl.NumberFormat('es-CO').format(numero);
  };

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = DEFAULT_PROFILE_IMAGE;
  };

  // Función para cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  // Cargar datos iniciales
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (!userData) {
          navigate('/');
          return;
        }

        // Cargar perfil del mesero
        const meseroQuery = query(
          collection(db, "vendedores"), 
          where("username", "==", userData.username)
        );
        const meseroSnapshot = await getDocs(meseroQuery);
        
        if (!meseroSnapshot.empty) {
          const meseroData = meseroSnapshot.docs[0].data();
          setUserProfile({
            nombre: meseroData.username,
            rol: meseroData.rol,
            imagenURL: meseroData.imagenURL || DEFAULT_PROFILE_IMAGE
          });
        }

        // Cargar productos
        const productosSnapshot = await getDocs(collection(db, "productos"));
        const productosData = productosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          categoria: doc.data().categoria || 'Sin categoría' // Asegurar que todos los productos tengan categoría
        }));
        setProductos(productosData);

        // Cargar mesas (crear algunas por defecto si no existen)
        await cargarMesas();
        
        // Cargar órdenes en proceso
        await cargarOrdenesEnProceso();

      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };

    cargarDatos();
  }, [navigate]);  const cargarMesas = async () => {
    try {
      const mesasSnapshot = await getDocs(collection(db, "mesas"));
      
      // Crear mesas del 1 al 10 si no existen o están incompletas
      const mesasExistentes = mesasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Verificar si tenemos las 10 mesas completas (1-10)
      const numerosExistentes = mesasExistentes.map(mesa => mesa.numero);
      const mesasCompletas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(num => 
        numerosExistentes.includes(num)
      );

      if (!mesasCompletas || mesasExistentes.length !== 10) {
        // Eliminar mesas existentes y crear nuevas
        for (const mesa of mesasExistentes) {
          await deleteDoc(doc(db, "mesas", mesa.id));
        }

        // Crear exactamente 10 mesas
        const mesasDefault = [];
        for (let i = 1; i <= 10; i++) {
          const mesaData = {
            numero: i,
            estado: 'libre',
            capacidad: i <= 3 ? 2 : i <= 6 ? 4 : i <= 9 ? 6 : 8
          };
          const mesaRef = await addDoc(collection(db, "mesas"), mesaData);
          mesasDefault.push({ id: mesaRef.id, ...mesaData });
        }
        setMesas(mesasDefault);
      } else {
        // Filtrar y ordenar las mesas existentes
        const mesasFiltradas = mesasExistentes
          .filter(mesa => mesa.numero >= 1 && mesa.numero <= 10)
          .sort((a, b) => a.numero - b.numero);
        setMesas(mesasFiltradas);
      }
    } catch (error) {
      console.error("Error al cargar mesas:", error);
    }
  };

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
      
      setOrdenesEnProceso(ordenesData.filter(orden => orden.estado === 'en_proceso'));
      setOrdenesParaCobrar(ordenesData.filter(orden => orden.estado === 'lista_para_cobrar'));
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
    }
  };
  // Funciones para manejo de órdenes
  const agregarProductoOrden = (producto) => {
    if (producto.cantidad <= 0) {
      alert('Producto sin stock');
      return;
    }

    const productoExistente = ordenActual.productos.find(p => p.id === producto.id);
    let nuevosProductos;
    
    if (productoExistente) {
      nuevosProductos = ordenActual.productos.map(p =>
        p.id === producto.id
          ? { ...p, cantidadOrden: p.cantidadOrden + 1 }
          : p
      );
    } else {
      nuevosProductos = [...ordenActual.productos, {
        ...producto,
        cantidadOrden: 1
      }];
    }

    const nuevoTotal = nuevosProductos.reduce(
      (sum, p) => sum + (p.precio * p.cantidadOrden), 0
    );

    setOrdenActual({
      ...ordenActual,
      productos: nuevosProductos,
      total: nuevoTotal
    });

    // En móvil, mostrar brevemente el panel y luego ocultarlo para seguir seleccionando
    if (isMobile()) {
      setMostrarPanelOrden(true);
      // Ocultar el panel después de un breve tiempo para permitir seguir seleccionando
      setTimeout(() => {
        setMostrarPanelOrden(false);
      }, 1500);
    }
  };

  const quitarProductoOrden = (productoId) => {
    const nuevosProductos = ordenActual.productos.filter(p => p.id !== productoId);
    const nuevoTotal = nuevosProductos.reduce(
      (sum, p) => sum + (p.precio * p.cantidadOrden), 0
    );

    setOrdenActual({
      ...ordenActual,
      productos: nuevosProductos,
      total: nuevoTotal
    });
  };
  const tomarOrden = async () => {
    try {
      if (!ordenActual.productos.length) {
        alert('Agregue productos a la orden');
        return;
      }

      if (!ordenActual.mesa) {
        alert('Seleccione una mesa');
        return;
      }

      // Si estamos editando una orden existente
      if (editandoOrden) {
        await guardarCambiosOrden();
        return;
      }

      // Crear nueva orden
      const ordenData = {
        productos: ordenActual.productos,
        mesa: ordenActual.mesa,
        total: ordenActual.total,
        notas: ordenActual.notas,
        mesero: userProfile.nombre,
        estado: 'en_proceso',
        fecha: Timestamp.now()
      };

      await addDoc(collection(db, "ordenes"), ordenData);

      // Actualizar estado de la mesa
      const mesaSeleccionada = mesas.find(m => m.numero.toString() === ordenActual.mesa);
      if (mesaSeleccionada) {
        await updateDoc(doc(db, "mesas", mesaSeleccionada.id), {
          estado: 'ocupada'
        });
      }

      // Limpiar orden actual
      setOrdenActual({
        productos: [],
        mesa: '',
        total: 0,
        notas: ''
      });

      // Recargar datos
      await cargarMesas();
      await cargarOrdenesEnProceso();
      
      alert('Orden tomada exitosamente');
    } catch (error) {
      console.error("Error al tomar orden:", error);
      alert('Error al tomar la orden');
    }
  };
  const marcarListaParaCobrar = async (ordenId) => {
    try {
      await updateDoc(doc(db, "ordenes", ordenId), {
        estado: 'lista_para_cobrar'
      });
      
      await cargarOrdenesEnProceso();
      alert('Orden marcada como lista para cobrar');
    } catch (error) {
      console.error("Error al marcar orden:", error);
    }
  };

  const editarOrden = (orden) => {
    setEditandoOrden(orden);
    setOrdenActual({
      productos: orden.productos.map(p => ({ ...p, cantidadOrden: p.cantidadOrden })),
      mesa: orden.mesa.toString(),
      total: orden.total,
      notas: orden.notas || ''
    });
  };

  const guardarCambiosOrden = async () => {
    try {
      if (!editandoOrden) return;

      const ordenActualizada = {
        productos: ordenActual.productos,
        total: ordenActual.total,
        notas: ordenActual.notas,
        fechaActualizacion: Timestamp.now()
      };

      await updateDoc(doc(db, "ordenes", editandoOrden.id), ordenActualizada);

      // Limpiar estado de edición
      setEditandoOrden(null);
      setOrdenActual({
        productos: [],
        mesa: '',
        total: 0,
        notas: ''
      });

      // Recargar órdenes
      await cargarOrdenesEnProceso();
      
      alert('Orden actualizada exitosamente');
    } catch (error) {
      console.error("Error al actualizar orden:", error);
      alert('Error al actualizar la orden');
    }
  };

  const cancelarEdicion = () => {
    setEditandoOrden(null);
    setOrdenActual({
      productos: [],
      mesa: '',
      total: 0,
      notas: ''
    });
  };

  const enviarACobrar = async (ordenId) => {
    try {
      const orden = ordenesParaCobrar.find(o => o.id === ordenId);
      if (!orden) return;

      // Crear venta para el vendedor
      const ventaData = {
        productos: orden.productos.map(p => ({
          ...p,
          cantidadVenta: p.cantidadOrden
        })),
        total: orden.total,
        mesa: orden.mesa,
        mesero: orden.mesero,
        estado: 'pendiente_cobro',
        fecha: Timestamp.now(),
        ordenId: ordenId
      };

      await addDoc(collection(db, "ventas_pendientes"), ventaData);
      
      // Eliminar de órdenes para cobrar
      await deleteDoc(doc(db, "ordenes", ordenId));
      
      // Liberar mesa
      const mesaOrden = mesas.find(m => m.numero.toString() === orden.mesa);
      if (mesaOrden) {
        await updateDoc(doc(db, "mesas", mesaOrden.id), {
          estado: 'libre'
        });
      }

      await cargarMesas();
      await cargarOrdenesEnProceso();
      
      alert('Orden enviada al vendedor para cobro');
    } catch (error) {
      console.error("Error al enviar orden:", error);
    }
  };

  // Función para renderizar secciones
  const renderSeccion = () => {
    switch(seccionActiva) {
      case 'panel':
        return (
          <div style={{ padding: '20px' }}>
            <h2>📊 Panel Principal</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile() ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
              marginTop: '20px'
            }}>
              <div style={{
                padding: '20px',
                backgroundColor: '#e3f2fd',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h3>Órdenes en Proceso</h3>
                <p style={{ fontSize: '2rem', margin: '10px 0' }}>{ordenesEnProceso.length}</p>
              </div>
              <div style={{
                padding: '20px',
                backgroundColor: '#f3e5f5',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h3>Listas para Cobrar</h3>
                <p style={{ fontSize: '2rem', margin: '10px 0' }}>{ordenesParaCobrar.length}</p>
              </div>
              <div style={{
                padding: '20px',
                backgroundColor: '#e8f5e8',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <h3>Mesas Libres</h3>
                <p style={{ fontSize: '2rem', margin: '10px 0' }}>
                  {mesas.filter(m => m.estado === 'libre').length}
                </p>
              </div>
            </div>
          </div>
        );

      case 'tomar_orden':
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
            gap: isMobile() ? '10px' : '15px',
            paddingBottom: isMobile() ? '120px' : '0'  // Espacio para el botón flotante en móvil
          }}>
            {/* Lista de productos */}
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
              
              <h2>🍽️ Menú</h2>
              
              {filtroCategoria !== 'Todas' ? (
                // Vista de productos filtrados por una categoría específica
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: getResponsiveColumns(),
                  gap: getResponsiveSize('8px', '12px', '15px'),
                  padding: getResponsiveSize('5px', '10px', '0')
                }}>
                  {productosFiltrados.map(producto => (
                    <ProductoCard 
                      key={producto.id} 
                      producto={producto} 
                      agregarProductoOrden={agregarProductoOrden}
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
                        borderBottom: '2px solid #28a745', 
                        paddingBottom: '8px',
                        marginBottom: '15px',
                        color: '#28a745'
                      }}>
                        {categoria}
                      </h3>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: getResponsiveColumns(),
                        gap: getResponsiveSize('8px', '12px', '15px'),
                        padding: getResponsiveSize('5px', '10px', '0')
                      }}>
                        {productosPorCategoria[categoria].map(producto => (
                          <ProductoCard 
                            key={producto.id} 
                            producto={producto} 
                            agregarProductoOrden={agregarProductoOrden}
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

            {/* Panel de orden actual - Condicional en móvil */}
            {(!isMobile() || (isMobile() && mostrarPanelOrden)) && (
              <div style={{ 
                width: '100%',
                maxWidth: isMobile() ? '100%' : '400px',
                height: isMobile() ? 'auto' : 'calc(100vh - 80px)',
                position: isMobile() ? 'fixed' : 'sticky',
                top: isMobile() ? 'auto' : '20px',
                bottom: isMobile() ? '0' : 'auto',
                left: isMobile() ? '0' : 'auto',
                backgroundColor: 'white',
                padding: getResponsiveSize('10px', '12px', '15px'),
                boxShadow: isMobile() ? '0 -4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: isMobile() ? '15px 15px 0 0' : '8px',
                maxHeight: isMobile() ? '70vh' : 'auto',  // Mayor altura para móvil
                overflow: isMobile() ? 'auto' : 'visible'
              }}>
                {/* Botón para cerrar en móvil */}
                {isMobile() && (
                  <div style={{ textAlign: 'right', marginBottom: '5px' }}>
                    <button
                      onClick={() => setMostrarPanelOrden(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: '#dc3545'
                      }}
                    >
                      ✖
                    </button>
                  </div>
                )}
                
                <h3 style={{ 
                  margin: '0 0 15px 0',
                  fontSize: getResponsiveSize('16px', '18px', '20px'),
                  textAlign: 'center',
                  color: editandoOrden ? '#ffc107' : '#2c3e50'
                }}>
                  {editandoOrden ? '✏️ Editando Orden' : '🍽️ Orden Actual'}
                  {editandoOrden && (
                    <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '5px' }}>
                      Mesa {editandoOrden.mesa}
                    </div>
                  )}
                </h3>
                
                {/* Selección de mesa */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Mesa:</label>                <select
                    value={ordenActual.mesa}
                    onChange={(e) => setOrdenActual({ ...ordenActual, mesa: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}
                  >                  <option value="">Seleccionar mesa</option>
                  {mesas
                    .filter(mesa => mesa.estado === 'libre')
                    .sort((a, b) => a.numero - b.numero)
                    .map(mesa => (
                    <option key={mesa.id} value={mesa.numero}>
                      Mesa {mesa.numero}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista de productos de la orden */}
              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                marginBottom: '15px',
                maxHeight: isMobile() ? '40vh' : 'calc(100vh - 400px)'
              }}>
                {ordenActual.productos.length === 0 ? (
                  <p>No hay productos en la orden</p>
                ) : (
                  ordenActual.productos.map(producto => (
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
                          ${formatearNumero(producto.precio)} x {producto.cantidadOrden}
                        </p>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span>${formatearNumero(producto.precio * producto.cantidadOrden)}</span>
                        <button
                          onClick={() => quitarProductoOrden(producto.id)}
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
                      </div>                    </div>
                  ))
                )}
              </div>

              {ordenActual.productos.length > 0 && (
                <div style={{ 
                  borderTop: '1px solid #eee',
                  paddingTop: '15px',
                  backgroundColor: 'white'
                }}>
                  {/* Notas */}
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Notas:</label>
                    <textarea
                      value={ordenActual.notas}
                      onChange={(e) => setOrdenActual({ ...ordenActual, notas: e.target.value })}
                      placeholder="Observaciones especiales..."
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        minHeight: '60px',
                        resize: 'vertical'
                      }}
                    />
                  </div>                  <h4 style={{ margin: '0 0 15px 0' }}>
                    Total: ${formatearNumero(ordenActual.total)}
                  </h4>
                  
                  <div style={{ display: 'flex', gap: '8px', flexDirection: isMobile() ? 'column' : 'row' }}>
                    {editandoOrden && (
                      <button
                        onClick={cancelarEdicion}
                        style={{
                          flex: 1,
                          padding: '12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                      >
                        ❌ Cancelar
                      </button>
                    )}
                    <button
                      onClick={tomarOrden}
                      style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: editandoOrden ? '#ffc107' : '#28a745',
                        color: editandoOrden ? 'black' : 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                    >
                      {editandoOrden ? '💾 Guardar Cambios' : '🍽️ Tomar Orden'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
            
            {/* Botón flotante para mostrar orden en móvil */}
            {isMobile() && !mostrarPanelOrden && ordenActual.productos.length > 0 && (
              <button
                onClick={() => setMostrarPanelOrden(true)}
                style={{
                  position: 'fixed',
                  bottom: '20px',
                  right: '20px',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '24px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                🛒
                <span style={{ fontSize: '12px', marginTop: '2px' }}>
                  {ordenActual.productos.length}
                </span>
              </button>
            )}
          </div>
        );

      case 'ordenes_proceso':
        return (
          <div style={{ padding: '20px' }}>
            <h2>⏳ Órdenes en Proceso</h2>
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
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: '#fff'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h4>Mesa {orden.mesa}</h4>
                      <span style={{ color: '#666' }}>
                        {orden.fecha?.seconds ? new Date(orden.fecha.seconds * 1000).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    
                    <div style={{ marginBottom: '10px' }}>
                      {orden.productos.map((prod, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          fontSize: '14px',
                          marginBottom: '5px'
                        }}>
                          <span>{prod.nombre} x{prod.cantidadOrden}</span>
                          <span>${formatearNumero(prod.precio * prod.cantidadOrden)}</span>
                        </div>
                      ))}
                    </div>

                    {orden.notas && (
                      <div style={{ 
                        marginBottom: '10px',
                        padding: '8px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}>
                        <strong>Notas:</strong> {orden.notas}
                      </div>
                    )}                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '15px',
                      gap: '10px',
                      flexWrap: 'wrap'
                    }}>
                      <strong>Total: ${formatearNumero(orden.total)}</strong>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => editarOrden(orden)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ffc107',
                            color: 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: getResponsiveSize('12px', '13px', '14px')
                          }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => marcarListaParaCobrar(orden.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: getResponsiveSize('12px', '13px', '14px')
                          }}
                        >
                          ✅ Lista para Cobrar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'ordenes_cobrar':
        return (
          <div style={{ padding: '20px' }}>
            <h2>💰 Órdenes para Cobrar</h2>
            {ordenesParaCobrar.length === 0 ? (
              <p>No hay órdenes listas para cobrar</p>
            ) : (
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: isMobile() ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '15px',
                marginTop: '20px'
              }}>
                {ordenesParaCobrar.map(orden => (
                  <div key={orden.id} style={{
                    border: '1px solid #28a745',
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: '#f8fff8'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h4>Mesa {orden.mesa}</h4>
                      <span style={{ color: '#666' }}>
                        {orden.fecha?.seconds ? new Date(orden.fecha.seconds * 1000).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    
                    <div style={{ marginBottom: '10px' }}>
                      {orden.productos.map((prod, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          fontSize: '14px',
                          marginBottom: '5px'
                        }}>
                          <span>{prod.nombre} x{prod.cantidadOrden}</span>
                          <span>${formatearNumero(prod.precio * prod.cantidadOrden)}</span>
                        </div>
                      ))}
                    </div>

                    {orden.notas && (
                      <div style={{ 
                        marginBottom: '10px',
                        padding: '8px',
                        backgroundColor: '#e8f5e8',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}>
                        <strong>Notas:</strong> {orden.notas}
                      </div>
                    )}

                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '15px'
                    }}>
                      <strong>Total: ${formatearNumero(orden.total)}</strong>
                      <button
                        onClick={() => enviarACobrar(orden.id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        💳 Enviar a Cobrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return renderSeccion();
    }
  };

  // Componente de tarjeta de producto (para evitar repetición de código)
  const ProductoCard = ({ producto, agregarProductoOrden, formatearNumero, isMobile }) => (
    <div 
      key={producto.id} 
      style={{ 
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '10px',
        backgroundColor: '#fff',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!isMobile()) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isMobile()) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {producto.imagenURL && (
        <img 
          src={producto.imagenURL} 
          alt={producto.nombre}
          style={{ 
            width: '100%', 
            height: '120px',
            objectFit: 'cover', 
            borderRadius: '4px',
            marginBottom: '10px'
          }}
        />
      )}
      <h4 style={{ 
        margin: '0 0 5px 0',
        fontSize: '14px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>{producto.nombre}</h4>
      <p style={{ 
        margin: '5px 0', 
        fontSize: '13px',
        color: '#007bff',
        fontWeight: 'bold'
      }}>
        ${formatearNumero(producto.precio)}
      </p>
      <p style={{ 
        margin: '5px 0', 
        fontSize: '12px',
        color: producto.cantidad > 0 ? '#28a745' : '#dc3545'
      }}>
        Stock: {formatearNumero(producto.cantidad)}
      </p>
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
      <button 
        onClick={() => agregarProductoOrden(producto)}
        disabled={producto.cantidad <= 0}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: producto.cantidad > 0 ? '#28a745' : '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: producto.cantidad > 0 ? 'pointer' : 'not-allowed',
          fontSize: '13px',
          fontWeight: 'bold',
          marginTop: '5px'
        }}
      >
        {producto.cantidad > 0 ? 'Agregar al Pedido' : 'Sin Stock'}
      </button>
    </div>
  );

  return (
    <>      {/* Mobile Header */}
    {isMobile() && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '50px',
        padding: '8px 15px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1000,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
          style={{
            padding: '8px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ☰
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src={userProfile.imagenURL}
            alt={userProfile.nombre}
            onError={handleImageError}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid #007bff'
            }}
          />
          <h3 style={{ margin: 0, fontSize: '14px', color: '#2c3e50' }}>
            {userProfile.nombre}
          </h3>
        </div>
      </div>
    )}

    {/* Main Layout Container */}
    <div style={{ 
      position: 'relative',
      height: '100vh',
      overflow: 'hidden'
    }}>
        {/* Sidebar */}
      <div style={{
        width: getResponsiveSize('250px', '240px', '250px'),
        height: '100vh',
        backgroundColor: '#f8f9fa',
        borderRight: '1px solid #dee2e6',
        position: isMobile() ? 'fixed' : 'fixed',
        left: isMobile() ? (menuMovilAbierto ? '0' : '-250px') : '0',
        top: 0,
        transition: isMobile() ? 'left 0.3s ease' : 'none',
        zIndex: isMobile() ? 1001 : 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        
        {/* Perfil del mesero */}
        <div style={{
          padding: getResponsiveSize('10px', '15px', '20px'),
          borderBottom: '1px solid #dee2e6',
          backgroundColor: '#ffffff',
          flexShrink: 0
        }}>
          <div style={{
            padding: getResponsiveSize('10px', '12px', '15px'),
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ 
              width: getResponsiveSize('50px', '60px', '70px'),
              height: getResponsiveSize('50px', '60px', '70px'),
              margin: '0 auto 10px auto',
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
                  border: '2px solid #007bff',
                  backgroundColor: '#f8f9fa'
                }}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ 
                margin: '0 0 5px 0',
                fontSize: getResponsiveSize('14px', '16px', '18px'),
                color: '#2c3e50',
                fontWeight: '600'
              }}>
                {userProfile.nombre}
              </h3>
              <span style={{
                display: 'inline-block',
                padding: '3px 8px',
                backgroundColor: '#ffc107',
                color: 'black',
                borderRadius: '12px',
                fontSize: getResponsiveSize('11px', '12px', '13px'),
                fontWeight: '500'
              }}>
                Mesero
              </span>
            </div>
          </div>
        </div>          {/* Navegación */}
        <nav style={{
          padding: getResponsiveSize('10px', '15px', '20px'),
          flex: 1,
          overflowY: 'auto'
        }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: getResponsiveSize('8px', '10px', '10px') }}>
              <button 
                onClick={() => {
                  setSeccionActiva('panel');
                  if (isMobile()) setMenuMovilAbierto(false);
                }}
                style={{
                  width: '100%',
                  padding: getResponsiveSize('8px', '10px', '10px'),
                  backgroundColor: seccionActiva === 'panel' ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: getResponsiveSize('13px', '14px', '14px'),
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
              >
                📊 Panel Principal
              </button>
            </li>
            <li style={{ marginBottom: getResponsiveSize('8px', '10px', '10px') }}>
              <button 
                onClick={() => {
                  setSeccionActiva('tomar_orden');
                  if (isMobile()) setMenuMovilAbierto(false);
                }}
                style={{
                  width: '100%',
                  padding: getResponsiveSize('8px', '10px', '10px'),
                  backgroundColor: seccionActiva === 'tomar_orden' ? '#28a745' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: getResponsiveSize('13px', '14px', '14px'),
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
              >
                🍽️ Tomar Orden
              </button>
            </li>
            <li style={{ marginBottom: getResponsiveSize('8px', '10px', '10px') }}>
              <button 
                onClick={() => {
                  setSeccionActiva('ordenes_proceso');
                  if (isMobile()) setMenuMovilAbierto(false);
                }}
                style={{
                  width: '100%',
                  padding: getResponsiveSize('8px', '10px', '10px'),
                  backgroundColor: seccionActiva === 'ordenes_proceso' ? '#ffc107' : '#6c757d',
                  color: seccionActiva === 'ordenes_proceso' ? 'black' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: getResponsiveSize('13px', '14px', '14px'),
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
              >
                ⏳ En Proceso ({ordenesEnProceso.length})
              </button>
            </li>
            <li style={{ marginBottom: getResponsiveSize('8px', '10px', '10px') }}>
              <button 
                onClick={() => {
                  setSeccionActiva('ordenes_cobrar');
                  if (isMobile()) setMenuMovilAbierto(false);
                }}
                style={{
                  width: '100%',
                  padding: getResponsiveSize('8px', '10px', '10px'),
                  backgroundColor: seccionActiva === 'ordenes_cobrar' ? '#17a2b8' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: getResponsiveSize('13px', '14px', '14px'),
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
              >
                💰 Para Cobrar ({ordenesParaCobrar.length})
              </button>
            </li>
          </ul>
        </nav>          {/* Botón de cerrar sesión - Fixed position */}
        <div style={{
          padding: getResponsiveSize('10px', '15px', '20px'),
          borderTop: '1px solid #dee2e6',
          backgroundColor: '#f8f9fa',
          flexShrink: 0,
          marginTop: 'auto', // This pushes it to the bottom
          position: 'sticky',
          bottom: 0
        }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: getResponsiveSize('10px', '12px', '12px'),
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s',
              fontSize: getResponsiveSize('13px', '14px', '14px'),
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
          >
            <span>🚪</span>
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
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
      )}        {/* Main Content - Fixed positioning to avoid overlap */}
      <div style={{ 
        position: 'absolute',
        left: isMobile() ? '0' : getResponsiveSize('250px', '240px', '250px'),
        right: '0',
        top: '0',
        bottom: '0',
        padding: getResponsiveSize('10px', '15px', '20px'),
        paddingTop: isMobile() ? '70px' : '20px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {renderSeccion()}
      </div>    </div>
    </>
  );
}

export default DashboardMesero;
