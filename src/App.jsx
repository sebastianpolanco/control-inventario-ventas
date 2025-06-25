import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function DashboardMesero() {
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
    imagenURL: ''
  });
  const [nuevoVendedor, setNuevoVendedor] = useState({
    username: '',
    password: '',
    rol: 'vendedor',
    imagen: null,
    imagenURL: ''
  });
  const [editandoProducto, setEditandoProducto] = useState(null);
  const [editandoVendedor, setEditandoVendedor] = useState(null);
  const [seccionActiva, setSeccionActiva] = useState('inventario');

  // Cargar perfil de usuario
  useEffect(() => {
    const cargarPerfilUsuario = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (userData && userData.id) {
          const userDoc = await getDocs(
            query(collection(db, "vendedores"), where("username", "==", userData.username))
          );
          
          if (!userDoc.empty) {
            const userInfo = userDoc.docs[0].data();
            setUserProfile({
              nombre: userInfo.username,
              rol: userInfo.rol,
              imagenURL: userInfo.imagenURL || 'https://via.placeholder.com/50'
            });
          }
        }
      } catch (error) {
        console.error("Error al cargar perfil:", error);
      }
    };
    cargarPerfilUsuario();
  }, []);

  // Modificar función agregarProducto
  const agregarProducto = async (e) => {
    e.preventDefault();
    console.log("Intentando agregar producto:", nuevoProducto);
    
    try {
      const productoData = {
        nombre: nuevoProducto.nombre,
        cantidad: parseInt(nuevoProducto.cantidad),
        precio: parseFloat(nuevoProducto.precio),
        imagenURL: nuevoProducto.imagenURL || '',
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
        imagenURL: ''
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

  const manejarImagenVendedor = (e, esEdicion = false) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      if (esEdicion) {
        setEditandoVendedor(prev => ({
          ...prev,
          imagen: file,
          imagenURL: imageUrl
        }));
      } else {
        setNuevoVendedor(prev => ({
          ...prev,
          imagen: file,
          imagenURL: imageUrl
        }));
      }
    }
  };

  const agregarVendedor = async (e) => {
    e.preventDefault();
    if (nuevoVendedor.username.trim()) {
      try {
        // Crear objeto con datos del vendedor
        const vendedorData = {
          username: nuevoVendedor.username,
          password: nuevoVendedor.password,
          rol: nuevoVendedor.rol || 'vendedor', // valor por defecto
          imagenURL: nuevoVendedor.imagenURL || '',
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
          imagen: null,
          imagenURL: ''
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
        imagenURL
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
    setEditandoVendedor({ ...vendedor, index });
  };

  const guardarEdicionVendedor = async () => {
    try {
      // Preparar datos actualizados
      const vendedorActualizado = {
        username: editandoVendedor.username,
        password: editandoVendedor.password,
        rol: editandoVendedor.rol,
        imagenURL: editandoVendedor.imagenURL || ''
      };

      // Actualizar en Firebase
      await updateDoc(doc(db, "vendedores", editandoVendedor.id), vendedorActualizado);

      // Actualizar estado local
      const nuevosVendedores = vendedores.map(v => 
        v.id === editandoVendedor.id ? {...vendedorActualizado, id: editandoVendedor.id} : v
      );
      setVendedores(nuevosVendedores);
      setEditandoVendedor(null);
      alert("Usuario actualizado exitosamente!");
    } catch (error) {
      console.error("Error al editar usuario:", error);
      alert("Error al editar usuario: " + error.message);
    }
  };

  const handleLogout = () => {
    // Add any cleanup logic here (clear tokens, etc)
    localStorage.removeItem('user'); // If you're storing user data
    sessionStorage.clear(); // Clear any session data
    navigate('/'); // Navigate to login page
  };

  const renderContenido = () => {
    switch(seccionActiva) {
      case 'inventario':
        return (
          <section>
            <h3>📦 Gestión de Inventario</h3>
            <form onSubmit={agregarProducto}>
              <input
                type="text"
                placeholder="Nombre del producto"
                value={nuevoProducto.nombre}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Cantidad"
                value={nuevoProducto.cantidad}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, cantidad: e.target.value })}
                required
              />
              <input
                type="number"
                placeholder="Precio"
                value={nuevoProducto.precio}
                onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })}
                required
              />
              <div style={{ marginBottom: '10px' }}>
                <p style={{ margin: '5px 0' }}>Imagen del producto:</p>
                <input
                  type="text"
                  placeholder="URL de la imagen"
                  value={nuevoProducto.imagenURL}
                  onChange={manejarImagenURL}
                  style={{ marginBottom: '5px', width: '100%' }}
                />
                <p style={{ margin: '5px 0' }}>O</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={manejarImagen}
                />
              </div>
              <button type="submit">Agregar</button>
            </form>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '20px',
              padding: '20px 0'
            }}>
              {productos.map((p, i) => (
                <div key={p.id || i} style={{ 
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {editandoProducto?.id === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        type="text"
                        value={editandoProducto.nombre}
                        onChange={(e) => setEditandoProducto({ ...editandoProducto, nombre: e.target.value })}
                      />
                      <input
                        type="number"
                        value={editandoProducto.cantidad}
                        onChange={(e) => setEditandoProducto({ ...editandoProducto, cantidad: e.target.value })}
                      />
                      <input
                        type="number"
                        value={editandoProducto.precio}
                        onChange={(e) => setEditandoProducto({ ...editandoProducto, precio: e.target.value })}
                      />
                      <div style={{ marginBottom: '10px' }}>
                        <p style={{ margin: '5px 0' }}>Imagen del producto:</p>
                        <input
                          type="text"
                          placeholder="URL de la imagen"
                          value={editandoProducto.imagenURL}
                          onChange={manejarImagenURLEdicion}
                          style={{ marginBottom: '5px', width: '100%' }}
                        />
                        <p style={{ margin: '5px 0' }}>O</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={manejarImagenEdicion}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={guardarEdicionProducto}>Guardar</button>
                        <button onClick={() => setEditandoProducto(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {p.imagenURL && 
                        <img 
                          src={p.imagenURL} 
                          alt={p.nombre} 
                          style={{ 
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                            borderRadius: '4px'
                          }}
                        />
                      }
                      <div style={{ marginTop: 'auto' }}>
                        <h4 style={{ margin: '0 0 5px 0' }}>{p.nombre}</h4>
                        <p style={{ margin: '0 0 5px 0' }}>{p.cantidad} unidades</p>
                        <p style={{ margin: '0 0 10px 0', color: '#007bff', fontWeight: 'bold' }}>${p.precio}</p>
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
          <section>
            <h3>👥 Gestión de Usuarios</h3>
            <form onSubmit={agregarVendedor}>
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={nuevoVendedor.username}
                onChange={(e) => setNuevoVendedor({...nuevoVendedor, username: e.target.value})}
                required
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={nuevoVendedor.password}
                onChange={(e) => setNuevoVendedor({...nuevoVendedor, password: e.target.value})}
                required
              />
              <select
                value={nuevoVendedor.rol}
                onChange={(e) => setNuevoVendedor({...nuevoVendedor, rol: e.target.value})}
                required
                style={{ padding: '8px', marginRight: '10px' }}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
                <option value="mesero">Mesero</option>
              </select>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => manejarImagenVendedor(e)}
              />
              <button type="submit">Agregar Usuario</button>
            </form>

            <ul style={{ listStyle: 'none', padding: 0 }}>
              {vendedores.map((v, i) => (
                <li key={i} style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '10px' }}>
                  {editandoVendedor?.index === i ? (
                    <div>
                      <input
                        type="text"
                        value={editandoVendedor.username}
                        onChange={(e) => setEditandoVendedor({...editandoVendedor, username: e.target.value})}
                      />
                      <input
                        type="password"
                        placeholder="Nueva contraseña"
                        value={editandoVendedor.password}
                        onChange={(e) => setEditandoVendedor({...editandoVendedor, password: e.target.value})}
                      />
                      <select
                        value={editandoVendedor.rol}
                        onChange={(e) => setEditandoVendedor({...editandoVendedor, rol: e.target.value})}
                        style={{ padding: '8px', marginRight: '10px' }}
                      >
                        <option value="vendedor">Vendedor</option>
                        <option value="admin">Administrador</option>
                        <option value="mesero">Mesero</option>
                      </select>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => manejarImagenVendedor(e, true)}
                      />
                      <button onClick={guardarEdicionVendedor}>Guardar</button>
                      <button onClick={() => setEditandoVendedor(null)}>Cancelar</button>
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
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Barra lateral */}
      <div style={{
        width: '250px',
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRight: '1px solid #dee2e6',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          {/* Profile section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '30px',
            padding: '10px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <img
              src={userProfile.imagenURL}
              alt="User Profile"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{userProfile.nombre}</h3>
              <small style={{ color: '#666' }}>
                {userProfile.rol.charAt(0).toUpperCase() + userProfile.rol.slice(1)}
              </small>
            </div>
          </div>

          <h2 style={{ marginBottom: '30px' }}>Panel Mesero</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => setSeccionActiva('inventario')}
              style={{
                padding: '10px',
                textAlign: 'left',
                backgroundColor: seccionActiva === 'inventario' ? '#007bff' : 'transparent',
                color: seccionActiva === 'inventario' ? 'white' : 'black',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
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
                cursor: 'pointer'
              }}
            >
              👥 Gestión de Usuarios
            </button>
          </nav>
        </div>

        {/* Logout button at bottom */}
        <button
          onClick={handleLogout}
          style={{
            padding: '10px',
            textAlign: 'left',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🚪</span> Cerrar Sesión
        </button>
      </div>

      {/* Contenido principal */}
      <div style={{ flex: 1, padding: '20px' }}>
        {renderContenido()}
      </div>
    </div>
  );
}

export default DashboardMesero;