const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

const uploadsDir = path.join(__dirname, 'uploads');
const moviesDir = path.join(uploadsDir, 'movies');
const imagesDir = path.join(uploadsDir, 'images');
const dataFile = path.join(__dirname, 'data', 'movies.json');

[uploadsDir, moviesDir, imagesDir, path.join(__dirname, 'data')].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'video' || file.fieldname.startsWith('episode_')) {
      cb(null, moviesDir);
    } else if (file.fieldname === 'image') {
      cb(null, imagesDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2000 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static('public'));

const readMovies = () => {
  try {
    if (fs.existsSync(dataFile)) {
      const data = fs.readFileSync(dataFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('خطأ في قراءة البيانات:', error);
  }
  return [];
};

const saveMovies = (movies) => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(movies, null, 2));
    return true;
  } catch (error) {
    console.error('خطأ في حفظ البيانات:', error);
    return false;
  }
};

app.get('/api/movies', (req, res) => {
  const movies = readMovies();
  res.json(movies);
});

app.post('/api/movies', upload.any(), (req, res) => {
  try {
    const { title, category, type } = req.body;
    const movies = readMovies();

    const imageFile = req.files.find(f => f.fieldname === 'image');
    
    const newItem = {
      id: Date.now(),
      title,
      category,
      type: type || 'movie',
      image: imageFile ? `/uploads/images/${imageFile.filename}` : ''
    };

    if (type === 'series') {
      // معالجة المسلسل - جمع الحلقات
      const episodes = [];
      req.files.forEach(file => {
        if (file.fieldname.startsWith('episode_')) {
          const episodeNum = file.fieldname.split('_')[1];
          episodes.push({
            number: parseInt(episodeNum),
            url: `/uploads/movies/${file.filename}`,
            title: `الحلقة ${episodeNum}`
          });
        }
      });
      episodes.sort((a, b) => a.number - b.number);
      newItem.episodes = episodes;
    } else {
      // معالجة الفيلم العادي
      const videoFile = req.files.find(f => f.fieldname === 'video');
      newItem.videoUrl = videoFile ? `/uploads/movies/${videoFile.filename}` : '';
    }

    movies.push(newItem);
    saveMovies(movies);

    res.json({ success: true, item: newItem });
  } catch (error) {
    console.error('خطأ في إضافة المحتوى:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/movies/:id', (req, res) => {
  try {
    const movieId = parseInt(req.params.id);
    let movies = readMovies();
    const movie = movies.find(m => m.id === movieId);

    if (movie) {
      // حذف الصورة
      if (movie.image && movie.image.startsWith('/uploads')) {
        const imagePath = path.join(__dirname, movie.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      // حذف الفيديو أو الحلقات
      if (movie.type === 'series' && movie.episodes) {
        movie.episodes.forEach(ep => {
          if (ep.url && ep.url.startsWith('/uploads')) {
            const videoPath = path.join(__dirname, ep.url);
            if (fs.existsSync(videoPath)) {
              fs.unlinkSync(videoPath);
            }
          }
        });
      } else if (movie.videoUrl && movie.videoUrl.startsWith('/uploads')) {
        const videoPath = path.join(__dirname, movie.videoUrl);
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      }

      movies = movies.filter(m => m.id !== movieId);
      saveMovies(movies);

      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'المحتوى غير موجود' });
    }
  } catch (error) {
    console.error('خطأ في حذف المحتوى:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const getLocalIP = () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};
// بدء السيرفر
app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   🎬 تطبيق الأفلام يعمل الآن!        ║ ✅');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n📍 من نفس الجهاز:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n📍 من أجهزة أخرى على الشبكة:`);
  console.log(`   http://${localIP}:${PORT}`);
  console.log('\n💡 شارك الرابط الثاني مع الأجهزة الأخرى');
  console.log('❇️  Ctrl+C لإيقاف السيرفر إضغط🚦\n');
});










