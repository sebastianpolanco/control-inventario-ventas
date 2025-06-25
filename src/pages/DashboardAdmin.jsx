import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const DEFAULT_PROFILE_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

const validateAndLoadImage = async (url) => {
  if (!url) return DEFAULT_PROFILE_IMAGE;
  try {
    const response = await fetch(url);
    if (!response.ok) return DEFAULT_PROFILE_IMAGE;
    return url;
  } catch {
    return DEFAULT_PROFILE_IMAGE;
  }
};

const isMobile = () => window.innerWidth < 768;
const getResponsiveSize = (mobileSize, desktopSize) => isMobile() ? mobileSize : desktopSize;

const AVATAR_OPTIONS = [
  'https://yca.org.ar/wp-content/uploads/sites/4/2019/06/perfil-avatar-hombre-icono-redondo_24640-14044.jpg',
  'https://img.freepik.com/vector-gratis/icono-vectorial-dibujos-animados-aspecto-perro-lindo-ilustracion-icono-naturaleza-animal-vector-plano-aislado_138676-12277.jpg',
  'https://static.vecteezy.com/system/resources/previews/014/212/681/non_2x/female-user-profile-avatar-is-a-woman-a-character-for-a-screen-saver-with-emotions-for-website-and-mobile-app-design-illustration-on-a-white-isolated-background-vector.jpg',
  'https://cdn.pixabay.com/photo/2016/03/31/19/58/avatar-1295429_1280.png',
  'https://www.shutterstock.com/image-vector/cat-avatar-profile-picture-3-260nw-1660658614.jpg'];

const CATEGORIAS_PRODUCTOS = [
  'Postres',
  'Bebidas',
  'Ensaladas de frutas',
  'Helados',
  'Cholados y raspados',
  'Café',
  'Comida rápida',
  'Adiciones'
];

function DashboardAdmin() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState({
    nombre: '',
    rol: '',
    imagenURL: 'https://via.placeholder.com/50'
  });
  const [adminProfile] = useState({
    nombre: 'Admin',
    imagenURL: 'https://via.placeholder.com/50',  // placeholder image, replace with actual admin image
  });
  const [productos, setProductos] = useState([]);
  const [vendedores, setVendedores] = useState([{ 
    username: 'vendedor1',
    password: '123456',
    rol: 'vendedor',
    imagen: null,
    imagenURL: ''
  }]);
  const [nuevoProducto, setNuevoProducto] = useState({ 
    nombre: '', 
    cantidad: '', 
    precio: '', 
    imagen: null,
    imagenURL: '',
    categoria: CATEGORIAS_PRODUCTOS[0] // Categoría por defecto
  });
  const [nuevoVendedor, setNuevoVendedor] = useState({
    username: '',
    password: '',
    rol: 'vendedor',
    imagenURL: AVATAR_OPTIONS[0] // Valor predeterminado
  });
  const [editandoProducto, setEditandoProducto] = useState(null);
  const [editandoVendedor, setEditandoVendedor] = useState(null);
  const [seccionActiva, setSeccionActiva] = useState('inventario');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [ventasDelDia, setVentasDelDia] = useState([]);
  const [totalDelDia, setTotalDelDia] = useState(0);
  const [topProductos, setTopProductos] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0],
    end: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]
  });
  const [metodoPagoStats, setMetodoPagoStats] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    otro: 0
  });
  // Añadir estado para filtro de categoría
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');

  // Añadir estado para las ventas por método de pago
  const [ventasPorMetodoPago, setVentasPorMetodoPago] = useState({
    efectivo: [],
    tarjeta: [],
    transferencia: [],
    nequi: [],
    daviplata: [],
    otro: []
  });
  
  // Cargar perfil de usuario
  useEffect(() => {
    const cargarPerfilUsuario = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (!userData) {
          navigate('/');
          return;
        }

        // Cargar perfil del usuario
        const userQuery = query(
          collection(db, "vendedores"), 
          where("username", "==", userData.username)
        );
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userInfo = userSnapshot.docs[0].data();
          setUserProfile({
            nombre: userInfo.username,
            rol: userInfo.rol,
            imagenURL: userInfo.imagenURL || DEFAULT_PROFILE_IMAGE
          });
          
          // Actualizar el localStorage con la imagen actual
          const updatedUserData = {
            ...userData,
            imagenURL: userInfo.imagenURL
          };
          localStorage.setItem('user', JSON.stringify(updatedUserData));
        }
      } catch (error) {
        console.error("Error al cargar perfil:", error);
        setUserProfile(prev => ({...prev, imagenURL: DEFAULT_PROFILE_IMAGE}));
      }
    };
    cargarPerfilUsuario();
  }, [navigate]);

  // Modificar función agregarProducto
  const agregarProducto = async (e) => {
    e.preventDefault();
    console.log("Intentando agregar producto:", nuevoProducto);
    
    try {
      // Check if product name already exists
      const productoQuery = query(
        collection(db, "productos"), 
        where("nombre", "==", nuevoProducto.nombre)
      );
      const productoSnapshot = await getDocs(productoQuery);

      if (!productoSnapshot.empty) {
        alert("Ya existe un producto con ese nombre. Por favor elija otro nombre.");
        return;
      }

      const productoData = {
        nombre: nuevoProducto.nombre,
        cantidad: parseInt(nuevoProducto.cantidad),
        precio: parseFloat(nuevoProducto.precio),
        imagenURL: nuevoProducto.imagenURL || '',
        categoria: nuevoProducto.categoria, // Agregar categoría
        fechaCreacion: new Date()
      };

      console.log("Datos a guardar:", productoData);
      
      const docRef = await addDoc(collection(db, "productos"), productoData);
      console.log("Documento guardado con ID:", docRef.id);

      // Actualizar estado local
      setProductos([...productos, { 
        id: docRef.id, 
        ...productoData
      }]);

      // Limpiar formulario
      setNuevoProducto({ 
        nombre: '', 
        cantidad: '', 
        precio: '', 
        imagen: null,
        imagenURL: '',
        categoria: CATEGORIAS_PRODUCTOS[0] // Mantener categoría por defecto
      });

      alert("Producto agregado exitosamente!");
    } catch (error) {
      console.error("Error detallado al agregar producto:", error);
      alert("Error al agregar producto: " + error.message);
    }
  };
  
  // Cargar productos al inicio
  useEffect(() => {
    const cargarProductos = async () => {
      try {
        console.log("Cargando productos...");
        const querySnapshot = await getDocs(collection(db, "productos"));
        const productosDB = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log("Productos cargados:", productosDB);
        setProductos(productosDB);
      } catch (error) {
        console.error("Error al cargar productos:", error);
      }
    };
    cargarProductos();
  }, []);

  // Cargar vendedores al inicio
  useEffect(() => {
    const cargarVendedores = async () => {
      const querySnapshot = await getDocs(collection(db, "vendedores"));
      const vendedoresDB = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVendedores(vendedoresDB);
    };
    cargarVendedores();
  }, []);

  // Cargar ventas del día
  useEffect(() => {
    const cargarVentas = async () => {
      try {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const ventasQuery = query(
          collection(db, "ventas"),
          where("fecha", "==", hoy)
        );
        const ventasSnapshot = await getDocs(ventasQuery);
        const ventasData = ventasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          fecha: doc.data().fecha.toDate()
        }));
        setVentasDelDia(ventasData);
        setTotalDelDia(ventasData.reduce((sum, v) => sum + v.total, 0));
        calcularTopProductos(ventasData);
        calcularEstadisticasMetodoPago(ventasData);
      } catch (error) {
        console.error("Error al cargar ventas:", error);
      }
    };
    cargarVentas();
  }, []);

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

  // Función para calcular estadísticas por método de pago
  const calcularEstadisticasMetodoPago = (ventas) => {
    const stats = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      otro: 0
    };
    
    const ventasPorMetodo = {
      efectivo: [],
      tarjeta: [],
      transferencia: [],
      nequi: [],
      daviplata: [],
      otro: []
    };
    
    ventas.forEach(venta => {
      // Si la venta tiene método de pago, sumamos al correspondiente
      // De lo contrario, lo consideramos como "otro"
      const metodoPago = venta.metodoPago ? venta.metodoPago.toLowerCase() : 'otro';
      
      if (metodoPago === 'efectivo') {
        stats.efectivo += venta.total;
        ventasPorMetodo.efectivo.push(venta);
      } else if (metodoPago === 'tarjeta') {
        stats.tarjeta += venta.total;
        ventasPorMetodo.tarjeta.push(venta);
      } else if (metodoPago === 'transferencia') {
        stats.transferencia += venta.total;
        ventasPorMetodo.transferencia.push(venta);
      } else if (metodoPago === 'nequi') {
        stats.otro += venta.total; // Añadimos a "otro" para mantener stats compatible
        ventasPorMetodo.nequi.push(venta);
      } else if (metodoPago === 'daviplata') {
        stats.otro += venta.total; // Añadimos a "otro" para mantener stats compatible
        ventasPorMetodo.daviplata.push(venta);
      } else {
        stats.otro += venta.total;
        ventasPorMetodo.otro.push(venta);
      }
    });
    
    setMetodoPagoStats(stats);
    setVentasPorMetodoPago(ventasPorMetodo);
  };
  
  // Cargar imagenes y manejar cambios de estado
  const manejarImagen = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setNuevoProducto({ 
        ...nuevoProducto, 
        imagen: file,
        imagenURL: imageUrl 
      });
    }
  };

  const manejarImagenURL = (e) => {
    setNuevoProducto({
      ...nuevoProducto,
      imagen: null,
      imagenURL: e.target.value
    });
  };

  const manejarImagenURLEdicion = (e) => {
    setEditandoProducto({
      ...editandoProducto,
      imagen: null,
      imagenURL: e.target.value
    });
  };

  const manejarImagenEdicion = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setEditandoProducto({
        ...editandoProducto,
        imagen: file,
        imagenURL: imageUrl
      });
    }
  };

  // Eliminar productos y vendedores
  const eliminarProducto = async (producto) => {
    try {
      // Si el producto tiene ID de Firebase, eliminarlo de Firebase
      if (producto.id) {
        await deleteDoc(doc(db, "productos", producto.id));
      }
      setProductos(productos.filter(p => p.id !== producto.id));
      alert("Producto eliminado exitosamente!");
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      alert("Error al eliminar producto: " + error.message);
    }
  };

  const agregarVendedor = async (e) => {
    e.preventDefault();
    if (nuevoVendedor.username.trim()) {
      try {
        // Check if username already exists
        const usernameQuery = query(
          collection(db, "vendedores"), 
          where("username", "==", nuevoVendedor.username)
        );
        const usernameSnapshot = await getDocs(usernameQuery);

        if (!usernameSnapshot.empty) {
          alert("Ya existe un usuario con ese nombre. Por favor elija otro nombre.");
          return;
        }

        const vendedorData = {
          username: nuevoVendedor.username,
          password: nuevoVendedor.password,
          rol: nuevoVendedor.rol || 'vendedor',
          imagenURL: nuevoVendedor.imagenURL,
          fechaCreacion: new Date()
        };

        // Guardar en Firestore
        const docRef = await addDoc(collection(db, "vendedores"), vendedorData);

        // Actualizar estado local
        setVendedores([...vendedores, { 
          id: docRef.id, 
          ...vendedorData 
        }]);

        // Limpiar formulario
        setNuevoVendedor({
          username: '',
          password: '',
          rol: 'vendedor',
          imagenURL: AVATAR_OPTIONS[0]
        });

        alert("Usuario agregado exitosamente!");
      } catch (error) {
        console.error("Error al agregar usuario:", error);
        alert("Error al agregar usuario: " + error.message);
      }
    }
  };

  const eliminarVendedor = async (vendedor) => {
    try {
      // Eliminar de Firebase
      await deleteDoc(doc(db, "vendedores", vendedor.id));
      
      // Actualizar estado local
      setVendedores(vendedores.filter(v => v.id !== vendedor.id));
      alert("Usuario eliminado exitosamente!");
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      alert("Error al eliminar usuario: " + error.message);
    }
  };

  const iniciarEdicionProducto = (producto, index) => {
    setEditandoProducto({ ...producto, index });
  };

  const guardarEdicionProducto = async () => {
    try {
      let imagenURL = editandoProducto.imagenURL;

      // Si hay una nueva imagen archivo, subirla
      if (editandoProducto.imagen && typeof editandoProducto.imagen === 'object') {
        const imageRef = ref(storage, `productos/${editandoProducto.imagen.name}`);
        await uploadBytes(imageRef, editandoProducto.imagen);
        imagenURL = await getDownloadURL(imageRef);
      }

      const productoActualizado = {
        nombre: editandoProducto.nombre,
        cantidad: parseInt(editandoProducto.cantidad),
        precio: parseFloat(editandoProducto.precio),
        imagenURL,
        categoria: editandoProducto.categoria || CATEGORIAS_PRODUCTOS[0] // Asegurar que tenga categoría
      };

      // Actualizar en Firebase
      await updateDoc(doc(db, "productos", editandoProducto.id), productoActualizado);

      // Actualizar estado local
      const nuevosProductos = productos.map(p => 
        p.id === editandoProducto.id ? {...productoActualizado, id: editandoProducto.id} : p
      );
      setProductos(nuevosProductos);
      setEditandoProducto(null);
      alert("Producto actualizado exitosamente!");
    } catch (error) {
      console.error("Error al editar producto:", error);
      alert("Error al editar producto: " + error.message);
    }
  };

  const iniciarEdicionVendedor = (vendedor, index) => {
    // Aseguramos que tenga una imagenURL, o usamos la primera opción predeterminada
    const vendedorConImagen = {
      ...vendedor,
      imagenURL: vendedor.imagenURL || AVATAR_OPTIONS[0],
      index
    };
    setEditandoVendedor(vendedorConImagen);
  };

  // Modificar guardarEdicionVendedor para actualizar el perfil del usuario actual cuando se edita su información
  const guardarEdicionVendedor = async () => {
    try {
      // Preparar datos actualizados
      const vendedorActualizado = {
        username: editandoVendedor.username,
        password: editandoVendedor.password,
        rol: editandoVendedor.rol,
        imagenURL: editandoVendedor.imagenURL
      };

      // Actualizar en Firebase
      await updateDoc(doc(db, "vendedores", editandoVendedor.id), vendedorActualizado);

      // Actualizar estado local
      const nuevosVendedores = vendedores.map(v => 
        v.id === editandoVendedor.id ? {...vendedorActualizado, id: editandoVendedor.id} : v
      );
      setVendedores(nuevosVendedores);

      // Si el usuario editado es el usuario actual, actualizar su perfil
      const userData = JSON.parse(localStorage.getItem('user'));
      if (userData && userData.username === editandoVendedor.username) {
        setUserProfile({
          ...userProfile,
          imagenURL: editandoVendedor.imagenURL
        });
        
        // Actualizar también en localStorage para mantener consistencia
        const updatedUserData = {
          ...userData,
          imagenURL: editandoVendedor.imagenURL
        };
        localStorage.setItem('user', JSON.stringify(updatedUserData));
      }

      setEditandoVendedor(null);
      alert("Usuario actualizado exitosamente!");
    } catch (error) {
      console.error("Error al editar usuario:", error);
      alert("Error al editar usuario: " + error.message);
    }
  };

  // Añadir función para refrescar el perfil del usuario actual
  const refrescarPerfilUsuario = async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      if (userData && userData.username) {
        const vendedorActual = vendedores.find(v => v.username === userData.username);
        if (vendedorActual) {
          setUserProfile({
            nombre: vendedorActual.username,
            rol: vendedorActual.rol,
            imagenURL: vendedorActual.imagenURL
          });
        }
      }
    } catch (error) {
      console.error("Error al refrescar perfil:", error);
    }
  };

  // Añadir efecto para refrescar el perfil cuando cambien los vendedores
  useEffect(() => {
    refrescarPerfilUsuario();
  }, [vendedores]);

  const handleLogout = () => {
    // Add any cleanup logic here (clear tokens, etc)
    localStorage.removeItem('user'); // If you're storing user data
    sessionStorage.clear(); // Clear any session data
    navigate('/'); // Navigate to login page
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'decimal',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(number);
  };

  // Cargar ventas por fecha
  const cargarVentasPorFecha = async (startDate, endDate) => {
    try {
      const fechaInicio = new Date(startDate + 'T00:00:00');
      const fechaFin = new Date(endDate + 'T23:59:59');

      const ventasQuery = query(
        collection(db, "ventas"),
        where("fecha", ">=", fechaInicio),
        where("fecha", "<=", fechaFin)
      );
      
      const ventasSnapshot = await getDocs(ventasQuery);
      const ventasData = ventasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha.toDate()
      }));

      setVentasDelDia(ventasData);
      setTotalDelDia(ventasData.reduce((sum, v) => sum + v.total, 0));
      calcularTopProductos(ventasData);
      calcularEstadisticasMetodoPago(ventasData);
    } catch (error) {
      console.error("Error al cargar ventas:", error);
    }
  };

  // Add useEffect to watch dateRange changes
  useEffect(() => {
    cargarVentasPorFecha(dateRange.start, dateRange.end);
  }, [dateRange]);

  // Modificar el renderContenido
  const renderContenido = () => {
    switch(seccionActiva) {
      case 'inventario':
        // Productos filtrados por categoría
        const productosFiltrados = filtroCategoria === 'Todas' 
          ? productos 
          : productos.filter(p => p.categoria === filtroCategoria);
          
        return (
          <section style={{ padding: window.innerWidth < 768 ? '10px' : '20px' }}>
            <h3>📦 Gestión de Inventario</h3>
            <form onSubmit={agregarProducto}>
              <input
                type="text"
                placeholder="Nombre del producto"
                value={nuevoProducto.nombre}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
                required
                style={{
                  padding: getResponsiveSize('8px', '10px'),
                  fontSize: getResponsiveSize('14px', '16px'),
                  marginBottom: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  width: '100%'
                }}
              />
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    placeholder="Cantidad"
                    value={nuevoProducto.cantidad}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, cantidad: e.target.value })}
                    required
                    style={{
                      padding: getResponsiveSize('8px', '10px'),
                      fontSize: getResponsiveSize('14px', '16px'),
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      width: '100%'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    placeholder="Precio"
                    value={nuevoProducto.precio}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })}
                    required
                    style={{
                      padding: getResponsiveSize('8px', '10px'),
                      fontSize: getResponsiveSize('14px', '16px'),
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      width: '100%'
                    }}
                  />
                </div>
              </div>
              
              {/* Selector de categoría */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Categoría:</label>
                <select
                  value={nuevoProducto.categoria}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, categoria: e.target.value })}
                  required
                  style={{
                    padding: getResponsiveSize('8px', '10px'),
                    fontSize: getResponsiveSize('14px', '16px'),
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                >
                  {CATEGORIAS_PRODUCTOS.map((cat, index) => (
                    <option key={index} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <p style={{ margin: '5px 0' }}>Imagen del producto:</p>
                <input
                  type="text"
                  placeholder="URL de la imagen"
                  value={nuevoProducto.imagenURL}
                  onChange={manejarImagenURL}
                  style={{ 
                    marginBottom: '5px', 
                    width: '100%',
                    padding: getResponsiveSize('8px', '10px'),
                    fontSize: getResponsiveSize('14px', '16px'),
                    border: '1px solid #ced4da',
                    borderRadius: '4px'
                  }}
                />
                <p style={{ margin: '5px 0' }}>O</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={manejarImagen}
                  style={{ 
                    padding: getResponsiveSize('8px', '10px'),
                    fontSize: getResponsiveSize('14px', '16px'),
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    width: '100%'
                  }}
                />
              </div>
              <button 
                type="submit"
                style={{
                  padding: getResponsiveSize('10px', '15px'),
                  fontSize: getResponsiveSize('16px', '18px'),
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background-color 0.3s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
              >
                Agregar Producto
              </button>
            </form>
            
            {/* Filtro de categorías */}
            <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column' }}>
              <label style={{ marginBottom: '8px', fontWeight: 'bold' }}>Filtrar por categoría:</label>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '8px'
              }}>
                <button
                  onClick={() => setFiltroCategoria('Todas')}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: filtroCategoria === 'Todas' ? '#007bff' : '#f8f9fa',
                    color: filtroCategoria === 'Todas' ? 'white' : '#212529',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Todas
                </button>
                {CATEGORIAS_PRODUCTOS.map((cat, index) => (
                  <button
                    key={index}
                    onClick={() => setFiltroCategoria(cat)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: filtroCategoria === cat ? '#007bff' : '#f8f9fa',
                      color: filtroCategoria === cat ? 'white' : '#212529',
                      border: '1px solid #dee2e6',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: isMobile() 
                ? 'repeat(auto-fill, minmax(140px, 1fr))'
                : 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: getResponsiveSize('8px', '20px'),
              padding: window.innerWidth < 768 ? '10px 0' : '20px 0'
            }}>
              {productosFiltrados.map((p, i) => (
                <div key={p.id || i} style={{ 
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: getResponsiveSize('10px', '15px'),
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {editandoProducto?.id === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        type="text"
                        value={editandoProducto.nombre}
                        onChange={(e) => setEditandoProducto({ ...editandoProducto, nombre: e.target.value })}
                        style={{
                          padding: getResponsiveSize('8px', '10px'),
                          fontSize: getResponsiveSize('14px', '16px'),
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          width: '100%'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="number"
                          value={editandoProducto.cantidad}
                          onChange={(e) => setEditandoProducto({ ...editandoProducto, cantidad: e.target.value })}
                          style={{
                            padding: getResponsiveSize('8px', '10px'),
                            fontSize: getResponsiveSize('14px', '16px'),
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            width: '100%'
                          }}
                        />
                        <input
                          type="number"
                          value={editandoProducto.precio}
                          onChange={(e) => setEditandoProducto({ ...editandoProducto, precio: e.target.value })}
                          style={{
                            padding: getResponsiveSize('8px', '10px'),
                            fontSize: getResponsiveSize('14px', '16px'),
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            width: '100%'
                          }}
                        />
                      </div>
                      
                      {/* Selector de categoría en edición */}
                      <select
                        value={editandoProducto.categoria || CATEGORIAS_PRODUCTOS[0]}
                        onChange={(e) => setEditandoProducto({ ...editandoProducto, categoria: e.target.value })}
                        required
                        style={{
                          padding: getResponsiveSize('8px', '10px'),
                          fontSize: getResponsiveSize('14px', '16px'),
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          width: '100%',
                          marginBottom: '10px'
                        }}
                      >
                        {CATEGORIAS_PRODUCTOS.map((cat, index) => (
                          <option key={index} value={cat}>{cat}</option>
                        ))}
                      </select>
                      
                      <div style={{ marginBottom: '10px' }}>
                        <p style={{ margin: '5px 0' }}>Imagen del producto:</p>
                        <input
                          type="text"
                          placeholder="URL de la imagen"
                          value={editandoProducto.imagenURL}
                          onChange={manejarImagenURLEdicion}
                          style={{ 
                            marginBottom: '5px', 
                            width: '100%',
                            padding: getResponsiveSize('8px', '10px'),
                            fontSize: getResponsiveSize('14px', '16px'),
                            border: '1px solid #ced4da',
                            borderRadius: '4px'
                          }}
                        />
                        <p style={{ margin: '5px 0' }}>O</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={manejarImagenEdicion}
                          style={{ 
                            padding: getResponsiveSize('8px', '10px'),
                            fontSize: getResponsiveSize('14px', '16px'),
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            width: '100%'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={guardarEdicionProducto}
                          style={{
                            padding: getResponsiveSize('10px', '15px'),
                            fontSize: getResponsiveSize('16px', '18px'),
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            width: '100%',
                            transition: 'background-color 0.3s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                        >
                          Guardar
                        </button>
                        <button 
                          onClick={() => setEditandoProducto(null)}
                          style={{
                            padding: getResponsiveSize('10px', '15px'),
                            fontSize: getResponsiveSize('16px', '18px'),
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            width: '100%',
                            transition: 'background-color 0.3s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {p.imagenURL && 
                        <img 
                          src={p.imagenURL} 
                          alt={p.nombre} 
                          onError={handleImageError}
                          loading="lazy"
                          style={{ 
                            width: '100%',
                            height: '120px',
                            objectFit: 'contain',
                            borderRadius: '4px',
                            backgroundColor: '#f8f9fa'
                          }}
                        />
                      }
                      <div style={{ marginTop: 'auto' }}>
                        <h4 style={{ margin: '0 0 5px 0' }}>{p.nombre}</h4>
                        <p style={{ margin: '0 0 5px 0' }}>{p.cantidad} unidades</p>
                        <p style={{ margin: '0 0 5px 0', color: '#007bff', fontWeight: 'bold' }}>
                          ${formatNumber(p.precio)}
                        </p>
                        {p.categoria && (
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            backgroundColor: '#e9ecef',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            marginBottom: '8px'
                          }}>
                            {p.categoria}
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => iniciarEdicionProducto(p, i)}>Editar</button>
                          <button 
                            onClick={() => eliminarProducto(p)}
                            style={{ backgroundColor: '#dc3545', color: 'white' }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      case 'usuarios':
        return (
          <section style={{ 
            padding: window.innerWidth < 768 ? '10px' : '20px',
            maxWidth: '100%',
            overflowX: 'auto'
          }}>
            <h3>👥 Gestión de Usuarios</h3>
            <form onSubmit={agregarVendedor}>
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={nuevoVendedor.username}
                onChange={(e) => setNuevoVendedor({...nuevoVendedor, username: e.target.value})}
                required
                style={{
                  padding: getResponsiveSize('8px', '10px'),
                  fontSize: getResponsiveSize('14px', '16px'),
                  marginBottom: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  width: '100%'
                }}
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={nuevoVendedor.password}
                onChange={(e) => setNuevoVendedor({...nuevoVendedor, password: e.target.value})}
                required
                style={{
                  padding: getResponsiveSize('8px', '10px'),
                  fontSize: getResponsiveSize('14px', '16px'),
                  marginBottom: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  width: '100%'
                }}
              />
              <select
                value={nuevoVendedor.rol}
                onChange={(e) => setNuevoVendedor({...nuevoVendedor, rol: e.target.value})}
                required
                style={{ 
                  padding: getResponsiveSize('8px', '10px'),
                  fontSize: getResponsiveSize('14px', '16px'),
                  marginBottom: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  width: '100%'
                }}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
                <option value="mesero">Mesero</option>
              </select>
              
              {/* Reemplazar la carga de imagen por selección de avatar */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '10px' }}>Seleccionar Avatar:</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                  gap: '10px' 
                }}>
                  {AVATAR_OPTIONS.map((avatar, index) => (
                    <div 
                      key={index}
                      onClick={() => setNuevoVendedor({...nuevoVendedor, imagenURL: avatar})}
                      style={{
                        padding: '5px',
                        border: nuevoVendedor.imagenURL === avatar ? '3px solid #007bff' : '1px solid #ced4da',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        backgroundColor: nuevoVendedor.imagenURL === avatar ? '#e6f2ff' : 'transparent'
                      }}
                    >
                      <img 
                        src={avatar} 
                        alt={`Avatar ${index + 1}`}
                        style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <button 
                type="submit"
                style={{
                  padding: getResponsiveSize('10px', '15px'),
                  fontSize: getResponsiveSize('16px', '18px'),
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background-color 0.3s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
              >
                Agregar Usuario
              </button>
            </form>

            {/* Lista de usuarios */}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {vendedores.map((v, i) => (
                <li key={i} style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '10px' }}>
                  {editandoVendedor?.index === i ? (
                    <div>
                      <input
                        type="text"
                        value={editandoVendedor.username}
                        onChange={(e) => setEditandoVendedor({...editandoVendedor, username: e.target.value})}
                        style={{
                          padding: getResponsiveSize('8px', '10px'),
                          fontSize: getResponsiveSize('14px', '16px'),
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          width: '100%',
                          marginBottom: '10px'
                        }}
                      />
                      <input
                        type="password"
                        placeholder="Nueva contraseña"
                        value={editandoVendedor.password}
                        onChange={(e) => setEditandoVendedor({...editandoVendedor, password: e.target.value})}
                        style={{
                          padding: getResponsiveSize('8px', '10px'),
                          fontSize: getResponsiveSize('14px', '16px'),
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          width: '100%',
                          marginBottom: '10px'
                        }}
                      />
                      <select
                        value={editandoVendedor.rol}
                        onChange={(e) => setEditandoVendedor({...editandoVendedor, rol: e.target.value})}
                        style={{ 
                          padding: getResponsiveSize('8px', '10px'),
                          fontSize: getResponsiveSize('14px', '16px'),
                          marginBottom: '10px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          width: '100%'
                        }}
                      >
                        <option value="vendedor">Vendedor</option>
                        <option value="admin">Administrador</option>
                        <option value="mesero">Mesero</option>
                      </select>
                      
                      {/* Selección de avatar para edición */}
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '10px' }}>Seleccionar Avatar:</label>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                          gap: '10px' 
                        }}>
                          {AVATAR_OPTIONS.map((avatar, index) => (
                            <div 
                              key={index}
                              onClick={() => setEditandoVendedor({...editandoVendedor, imagenURL: avatar})}
                              style={{
                                padding: '5px',
                                border: editandoVendedor.imagenURL === avatar ? '3px solid #007bff' : '1px solid #ced4da',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                backgroundColor: editandoVendedor.imagenURL === avatar ? '#e6f2ff' : 'transparent'
                              }}
                            >
                              <img 
                                src={avatar} 
                                alt={`Avatar ${index + 1}`}
                                style={{
                                  width: '50px',
                                  height: '50px',
                                  borderRadius: '50%',
                                  objectFit: 'cover'
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={guardarEdicionVendedor}
                          style={{
                            padding: getResponsiveSize('10px', '15px'),
                            fontSize: getResponsiveSize('16px', '18px'),
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            flex: 1,
                            transition: 'background-color 0.3s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                        >
                          Guardar
                        </button>
                        <button 
                          onClick={() => setEditandoVendedor(null)}
                          style={{
                            padding: getResponsiveSize('10px', '15px'),
                            fontSize: getResponsiveSize('16px', '18px'),
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            flex: 1,
                            transition: 'background-color 0.3s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {v.imagenURL && 
                        <img 
                          src={v.imagenURL} 
                          alt={v.username} 
                          style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      }
                      <div>
                        <strong>{v.username}</strong>
                        <span style={{ 
                          marginLeft: '10px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: (v.rol || 'vendedor') === 'admin' ? '#dc3545' : (v.rol || 'vendedor') === 'mesero' ? '#ffc107' : '#28a745',
                          color: (v.rol || 'vendedor') === 'mesero' ? 'black' : 'white',
                          fontSize: '0.8em'
                        }}>
                          {((v.rol || 'vendedor').charAt(0).toUpperCase() + (v.rol || 'vendedor').slice(1))}
                        </span>
                        <button onClick={() => iniciarEdicionVendedor(v, i)}>Editar</button>
                        <button onClick={() => eliminarVendedor(v)}>Eliminar</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      case 'ventas':
        // Crear array con todos los métodos de pago y sus datos para mostrar
        const metodosPago = [
          { nombre: 'Efectivo', color: '#198754', ventas: ventasPorMetodoPago.efectivo, total: metodoPagoStats.efectivo },
          { nombre: 'Tarjeta', color: '#0d6efd', ventas: ventasPorMetodoPago.tarjeta, total: metodoPagoStats.tarjeta },
          { nombre: 'Transferencia', color: '#6f42c1', ventas: ventasPorMetodoPago.transferencia, total: metodoPagoStats.transferencia },
          { nombre: 'Nequi', color: '#e83e8c', ventas: ventasPorMetodoPago.nequi, total: ventasPorMetodoPago.nequi.reduce((sum, v) => sum + v.total, 0) },
          { nombre: 'Daviplata', color: '#fd7e14', ventas: ventasPorMetodoPago.daviplata, total: ventasPorMetodoPago.daviplata.reduce((sum, v) => sum + v.total, 0) },
          { nombre: 'Otros', color: '#6c757d', ventas: ventasPorMetodoPago.otro, total: metodoPagoStats.otro - 
            (ventasPorMetodoPago.nequi.reduce((sum, v) => sum + v.total, 0) + 
             ventasPorMetodoPago.daviplata.reduce((sum, v) => sum + v.total, 0)) }
        ];
        
        return (
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label>Desde:</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label>Hasta:</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                  }}
                />
              </div>
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Actualizar
              </button>
            </div>

            <h2>📊 Panel de Ventas</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(3, 1fr)', 
              gap: '20px',
              marginBottom: '30px' 
            }}>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#28a745', 
                color: 'white', 
                borderRadius: '8px',
                textAlign: 'center' 
              }}>
                <h3>Ventas del Día</h3>
                <h2>${formatNumber(totalDelDia)}</h2>
              </div>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#007bff', 
                color: 'white', 
                borderRadius: '8px',
                textAlign: 'center' 
              }}>
                <h3>Total de Ventas</h3>
                <h2>{formatNumber(ventasDelDia.length)}</h2>
              </div>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#17a2b8', 
                color: 'white', 
                borderRadius: '8px',
                textAlign: 'center' 
              }}>
                <h3>Promedio por Venta</h3>
                <h2>${formatNumber(ventasDelDia.length ? totalDelDia / ventasDelDia.length : 0)}</h2>
              </div>
            </div>

            {/* Métodos de Pago Section */}
            <h3>Ventas por Método de Pago</h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(3, 1fr)',
              gap: '15px',
              marginBottom: '30px'
            }}>
              {metodosPago.map((metodo, index) => (
                <div key={index} style={{ 
                  padding: '15px',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  backgroundColor: metodo.color,
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>{metodo.nombre}</h4>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold' 
                  }}>
                    ${formatNumber(metodo.total)}
                  </p>
                  <p>({metodo.ventas.length} ventas)</p>
                </div>
              ))}
            </div>
            
            {/* Detalles de Ventas por Método de Pago */}
            <div style={{ marginBottom: '30px' }}>
              {metodosPago.filter(metodo => metodo.ventas.length > 0).map((metodo, index) => (
                <div key={index} style={{ marginBottom: '30px' }}>
                  <h3 style={{ 
                    color: metodo.color, 
                    borderBottom: `2px solid ${metodo.color}`,
                    paddingBottom: '8px'
                  }}>
                    Ventas por {metodo.nombre}
                  </h3>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {metodo.ventas.map(venta => (
                      <div key={venta.id} style={{ 
                        padding: '10px', 
                        border: `1px solid ${metodo.color}`,
                        marginBottom: '10px',
                        borderRadius: '4px',
                        backgroundColor: 'white'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ margin: '5px 0' }}><strong>Total:</strong> ${formatNumber(venta.total)}</p>
                            <p style={{ margin: '5px 0' }}><strong>Vendedor:</strong> {venta.vendedorNombre}</p>
                            <p style={{ margin: '5px 0' }}><strong>Fecha:</strong> {venta.fecha.toLocaleString()}</p>
                          </div>
                          <div style={{
                            backgroundColor: metodo.color,
                            color: 'white',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.8rem'
                          }}>
                            {metodo.nombre}
                          </div>
                        </div>
                        
                        <div style={{ 
                          marginTop: '10px', 
                          borderTop: '1px solid #eee',
                          paddingTop: '10px'
                        }}>
                          <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Productos:</p>
                          <ul style={{ margin: 0, paddingLeft: '20px' }}>
                            {venta.productos && venta.productos.map((prod, i) => (
                              <li key={i}>
                                {prod.nombre} - {prod.cantidadVenta} x ${formatNumber(prod.precio)} 
                                = ${formatNumber(prod.precio * prod.cantidadVenta)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Top Productos Section */}
            <h3>Top 3 Productos Más Vendidos</h3>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(3, 1fr)',
              gap: '20px',
              marginBottom: '30px'
            }}>
              {topProductos.map((producto) => (
                <div key={producto.id} style={{ 
                  padding: '15px',
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {producto.imagenURL && (
                    <img 
                      src={producto.imagenURL}
                      alt={producto.nombre}
                      style={{
                        width: '100%',
                        height: '80px', // Reduced from 100px
                        objectFit: 'contain', // Changed from 'cover' to 'contain'
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa' // Added background for better visibility
                      }}
                    />
                  )}
                  <h4 style={{ margin: 0 }}>{producto.nombre}</h4>
                  <p style={{ margin: 0 }}>Cantidad vendida: {formatNumber(producto.cantidadTotal)}</p>
                  <p style={{ margin: 0, color: '#007bff', fontWeight: 'bold' }}>
                    ${formatNumber(producto.ventasTotal)} en total
                  </p>
                </div>
              ))}
            </div>

            <h3>Últimas Ventas</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {[...ventasDelDia].reverse().slice(0, 5).map(venta => (
                <div key={venta.id} style={{ 
                  padding: '10px', 
                  border: '1px solid #dee2e6',
                  marginBottom: '10px',
                  borderRadius: '4px',
                  backgroundColor: 'white'
                }}>
                  <p>Total: ${formatNumber(venta.total)}</p>
                  <p>Vendedor: {venta.vendedorNombre}</p>
                  <p>Hora: {venta.fecha.toLocaleTimeString()}</p>
                  <p>Método de Pago: {venta.metodoPago || 'No especificado'}</p>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleImageError = (e) => {
    e.target.onerror = null; // Prevent infinite loop
    e.target.src = DEFAULT_PROFILE_IMAGE;
  };

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      fontSize: getResponsiveSize('14px', '16px')
    }}>
      {/* Barra superior móvil */}
      {isMobile() && (
        <div style={{
          padding: '8px',
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
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '20px'
            }}
          >
            ☰
          </button>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{userProfile.nombre}</h3>
        </div>
      )}

      {/* Barra lateral */}
      <div style={{
        width: getResponsiveSize('80%', '250px'),
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
        {/* Sección superior fija */}
        <div style={{
          padding: getResponsiveSize('15px', '20px'),
          borderBottom: '1px solid #dee2e6',
          backgroundColor: '#f8f9fa'
        }}>
          {/* Profile section */}
          <div style={{
            padding: '15px',
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}>
            <div style={{ 
              width: getResponsiveSize('60px', '80px'),
              height: getResponsiveSize('60px', '80px'),
              margin: '0 auto 15px auto',
              position: 'relative'
            }}>
              <img 
                src={userProfile.imagenURL || DEFAULT_PROFILE_IMAGE}
                alt="User Profile"
                onError={handleImageError}
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid #007bff',
                  backgroundColor: '#f8f9fa'
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
                {userProfile.rol.charAt(0).toUpperCase() + userProfile.rol.slice(1)}
              </span>
            </div>
          </div>
          <h2 style={{ marginTop: '20px', marginBottom: '10px' }}>Panel Admin</h2>
        </div>

        {/* Sección de navegación con scroll */}
        <nav style={{ 
          padding: '20px',
          flex: 1,
          overflowY: 'auto'
        }}>
          <button
            onClick={() => setSeccionActiva('inventario')}
            style={{
              padding: '10px',
              textAlign: 'left',
              backgroundColor: seccionActiva === 'inventario' ? '#007bff' : 'transparent',
              color: seccionActiva === 'inventario' ? 'white' : 'black',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '10px'
            }}
          >
            📦 Gestión de Inventario
          </button>
          <button
            onClick={() => setSeccionActiva('usuarios')}
            style={{
              padding: '10px',
              textAlign: 'left',
              backgroundColor: seccionActiva === 'usuarios' ? '#007bff' : 'transparent',
              color: seccionActiva === 'usuarios' ? 'white' : 'black',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '10px'
            }}
          >
            👥 Gestión de Usuarios
          </button>
          <button
            onClick={() => setSeccionActiva('ventas')}
            style={{
              padding: '10px',
              textAlign: 'left',
              backgroundColor: seccionActiva === 'ventas' ? '#007bff' : 'transparent',
              color: seccionActiva === 'ventas' ? 'white' : 'black',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '10px'
            }}
          >
            📊 Panel de Ventas
          </button>
        </nav>

        {/* Sección inferior fija */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #dee2e6',
          backgroundColor: '#f8f9fa'
        }}>
          <button
            onClick={handleLogout}
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

      {/* Overlay for mobile */}
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

      {/* Main content */}
      <div style={{ 
        marginLeft: isMobile() ? '0' : '250px',
        flex: 1,
        padding: getResponsiveSize('10px', '40px'),
        height: '100vh',
        overflowY: 'auto',
        paddingBottom: isMobile() ? '60px' : '40px'
      }}>
        {renderContenido()}
      </div>
    </div>
  );
}

export default DashboardAdmin;
