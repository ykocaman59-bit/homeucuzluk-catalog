// Firebase Ayarları ve Canlı Bağlantı
const firebaseConfig = {
  apiKey: "AIzaSyDcQLq-7KlC8qqf3jn3raCS9TIU0aDhoj8",
  authDomain: "homeucuzluk-dd9c8.firebaseapp.com",
  projectId: "homeucuzluk-dd9c8",
  storageBucket: "homeucuzluk-dd9c8.firebasestorage.app",
  messagingSenderId: "113132988890",
  appId: "1:113132988890:web:1952c045fb4173f0d3b8e3"
};

// Firebase Başlatma
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const ADMIN_PASSWORD = "14531453";
let selectedCatalogGroup = null;
let aktifIndeks = 0;

// Tarihi YYYY-AA-GG formatından GG.AA.YYYY formatına çevirir
function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
}

document.addEventListener('DOMContentLoaded', async () => {
    checkAuthStatus();
    renderProducts();

    // Görsel Yüklendiğinde Metin Tarama
    document.getElementById('image-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const status = document.getElementById('ocr-status');
        status.innerText = "⏳ Görsel okunuyor, lütfen bekleyin...";

        const compressedImage = await compressImage(file, 900, 0.75);
        document.getElementById('image-preview').src = compressedImage;
        document.getElementById('image-preview-container').classList.remove('hidden');

        try {
            const worker = await Tesseract.createWorker('tur');
            const ret = await worker.recognize(file);
            await worker.terminate();

            const text = ret.data.text.trim();
            status.innerText = "✅ Görsel başarıyla taranıp bilgiler aktarıldı!";

            const priceMatch = text.match(/(\d+[\.,]?\d*)\s*(TL|tl|₺)/);
            if (priceMatch) {
                document.getElementById('price-input').value = priceMatch[1].replace(',', '.');
            }

            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
            if (lines.length > 0) {
                document.getElementById('title-input').value = lines[0].substring(0, 60);
                document.getElementById('desc-input').value = lines.join(' ');
            } else {
                document.getElementById('desc-input').value = text;
            }

        } catch (err) {
            status.innerText = "⚠️ Metin tam okunamadı, bilgileri elle tamamlayabilirsiniz.";
        }
    });

    // Form Gönderimi (Firebase'e Kayıt)
    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = document.getElementById('type-input').value;
        const startDate = document.getElementById('start-date-input').value;
        const expiry = document.getElementById('expiry-input').value;

        if (type === 'insert' && (!startDate || !expiry)) {
            alert("Lütfen katalog için başlangıç ve bitiş tarihlerini belirtiniz!");
            return;
        }

        const newProduct = {
            createdAt: Date.now(),
            title: document.getElementById('title-input').value,
            price: document.getElementById('price-input').value,
            desc: document.getElementById('desc-input').value,
            condition: document.getElementById('condition-input').value,
            shipping: document.getElementById('shipping-input').value,
            type: type,
            startDate: startDate || '',
            expiry: expiry || '',
            image: document.getElementById('image-preview').src
        };

        try {
            await saveProductToDB(newProduct);
            alert("✅ Ürün başarıyla canlı veritabanına eklendi!");

            document.getElementById('add-product-form').reset();
            document.getElementById('image-preview-container').classList.add('hidden');
            document.getElementById('ocr-status').innerText = "Görsel seçildiğinde bilgiler otomatik taranacaktır...";
            
            renderProducts();
        } catch (error) {
            alert("❌ Ürün eklenirken bir hata oluştu: " + error.message);
        }
    });
});

// Firebase Veritabanına Ürün Ekleme
async function saveProductToDB(product) {
    await db.collection("products").add(product);
}

// Firebase Veritabanından Tüm Ürünleri Çekme
async function getAllProductsFromDB() {
    try {
        const snapshot = await db.collection("products").orderBy("createdAt", "desc").get();
        let products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        return products;
    } catch (error) {
        console.error("Veri çekme hatası:", error);
        return [];
    }
}

// Firebase Veritabanından Ürün Silme
async function deleteProductFromDB(id) {
    try {
        await db.collection("products").doc(id).delete();
    } catch (error) {
        console.error("Silme hatası:", error);
    }
}

function compressImage(file, maxWidth, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
}

async function renderProducts() {
    const products = await getAllProductsFromDB();

    const slidesContainer = document.getElementById('carouselSlides');
    const noktalarKutusu = document.getElementById('noktalarKutusu');
    const productGrid = document.getElementById('product-grid');
    const catalogProductsGrid = document.getElementById('catalog-products-grid');
    const adminList = document.getElementById('admin-product-list');
    const tabsContainer = document.getElementById('catalog-tabs');

    slidesContainer.innerHTML = '';
    noktalarKutusu.innerHTML = '';
    productGrid.innerHTML = '';
    catalogProductsGrid.innerHTML = '';
    adminList.innerHTML = '';
    tabsContainer.innerHTML = '';

    const insertGroups = {};

    products.forEach(item => {
        const adminItem = document.createElement('div');
        adminItem.className = 'admin-item';
        adminItem.innerHTML = `
            <span><b>${item.title}</b> (${item.price} ₺) [${item.type === 'insert' ? 'İnsert: ' + formatDate(item.startDate) + ' / ' + formatDate(item.expiry) : 'Tekil Ürün'}]</span>
            <button onclick="removeProduct('${item.id}')" style="background:#e50914; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Sil</button>
        `;
        adminList.appendChild(adminItem);

        if (item.type === 'insert') {
            const groupKey = `${item.startDate}_${item.expiry}`;
            if (!insertGroups[groupKey]) {
                insertGroups[groupKey] = {
                    startDate: item.startDate,
                    expiry: item.expiry,
                    items: []
                };
            }
            insertGroups[groupKey].items.push(item);
        } else {
            const card = createProductCard(item);
            productGrid.appendChild(card);
        }
    });

    const groupKeys = Object.keys(insertGroups);
    if (groupKeys.length > 0) {
        if (!selectedCatalogGroup || !insertGroups[selectedCatalogGroup]) {
            selectedCatalogGroup = groupKeys[0];
        }

        groupKeys.forEach(key => {
            const group = insertGroups[key];
            const btn = document.createElement('button');
            btn.className = `catalog-tab-btn ${key === selectedCatalogGroup ? 'active' : ''}`;
            btn.innerText = `📅 ${formatDate(group.startDate)} - ${formatDate(group.expiry)}`;
            btn.onclick = () => {
                selectedCatalogGroup = key;
                renderProducts();
            };
            tabsContainer.appendChild(btn);
        });

        const activeGroup = insertGroups[selectedCatalogGroup];
        document.getElementById('baslangic-tarihi').innerText = formatDate(activeGroup.startDate);
        document.getElementById('bitis-tarihi').innerText = formatDate(activeGroup.expiry);

        activeGroup.items.forEach((item, idx) => {
            // Katalog Sağa/Sola Kaydırmalı Resimler
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.innerHTML = `<img src="${item.image}" alt="${item.title}">`;
            slidesContainer.appendChild(slide);

            const nokta = document.createElement('div');
            nokta.className = `nokta ${idx === 0 ? 'aktif' : ''}`;
            nokta.onclick = () => suankiSayfa(idx);
            noktalarKutusu.appendChild(nokta);

            // Kataloğun Dışında/Altında Dizilecek Ürün Kartları
            const catalogProductCard = createProductCard(item);
            catalogProductsGrid.appendChild(catalogProductCard);
        });
        aktifIndeks = 0;
        suankiSayfa(0);
    } else {
        slidesContainer.innerHTML = `
            <div class="slide">
                <div class="bos-alan-yazisi">
                    <i class="fa-regular fa-images" style="font-size: 36px; display:block; margin-bottom:8px;"></i>
                    Aktif Katalog Bulunmuyor
                </div>
            </div>
        `;
        catalogProductsGrid.innerHTML = '<p style="text-align:center; color:#888; width:100%;">Bu katalogda ürün bulunmuyor.</p>';
    }
}

function createProductCard(item) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const safeTitle = (item.title || '').replace(/'/g, "\\'");
    
    card.innerHTML = `
        <img src="${item.image}" alt="${item.title}">
        <div class="product-card-body">
            <h3>${item.title}</h3>
            <div class="price-tag">${item.price} ₺</div>
            <div style="margin-bottom:8px;">
                <span class="badge badge-condition">${item.condition || 'Sıfır'}</span>
                <span class="badge badge-shipping">${item.shipping}</span>
            </div>
            <p style="font-size:0.85rem; color:#666; margin-bottom:8px;">${item.desc || ''}</p>
            <button onclick="orderViaInstagram('${safeTitle}', '${item.price}', '${item.shipping}', '${item.id}')" class="dm-btn">
                💬 Instagram DM ile Sipariş Et
            </button>
        </div>
    `;
    return card;
}

function checkAuthStatus() {
    const isLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';
    const adminPanel = document.getElementById('admin-panel');
    const authBtn = document.getElementById('auth-btn');

    if (isLoggedIn) {
        adminPanel.classList.remove('hidden');
        authBtn.innerText = "👤 Yönetici Paneli Açık";
        authBtn.style.background = "#28a745";
    } else {
        adminPanel.classList.add('hidden');
        authBtn.innerText = "⚙️ Yönetim Paneli";
        authBtn.style.background = "#e50914";
    }
}

function handleAuthAction() {
    const isLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';
    if (isLoggedIn) {
        document.getElementById('admin-panel').classList.toggle('hidden');
    } else {
        const inputPassword = prompt("Lütfen Yönetici Şifresini Giriniz:");
        if (inputPassword === ADMIN_PASSWORD) {
            sessionStorage.setItem('admin_logged_in', 'true');
            checkAuthStatus();
        } else if (inputPassword !== null) {
            alert("❌ Hatalı şifre!");
        }
    }
}

function logoutAdmin() {
    sessionStorage.removeItem('admin_logged_in');
    checkAuthStatus();
    alert("Yönetici oturumu kapatıldı.");
}

function toggleDateFields() {
    const type = document.getElementById('type-input').value;
    const dateFields = document.getElementById('date-fields');
    if (type === 'single') {
        dateFields.style.display = 'none';
    } else {
        dateFields.style.display = 'flex';
    }
}

function sayfaDegistir(yon) {
    const slides = document.querySelectorAll('.slide');
    if (slides.length <= 1) return;

    aktifIndeks += yon;
    if (aktifIndeks >= slides.length) aktifIndeks = 0;
    if (aktifIndeks < 0) aktifIndeks = slides.length - 1;

    suankiSayfa(aktifIndeks);
}

function suankiSayfa(indeks) {
    aktifIndeks = indeks;
    const slidesContainer = document.getElementById('carouselSlides');
    if(slidesContainer){
        slidesContainer.style.transform = `translateX(-${aktifIndeks * 100}%)`;
    }

    const noktalar = document.querySelectorAll('.nokta');
    noktalar.forEach((n, i) => {
        n.classList.toggle('aktif', i === aktifIndeks);
    });
}

function orderViaInstagram(title, price, shipping, productId) {
    const currentUrl = window.location.href.split('?')[0];
    const productUrl = `${currentUrl}?product=${productId || encodeURIComponent(title)}`;

    const text = `Merhaba @homeucuzluk, web sitenizden şu ürünü sipariş etmek istiyorum:\n\n📦 Ürün: ${title}\n💰 Fiyat: ${price} TL\n🚚 Kargo: ${shipping}\n🔗 Ürün Linki: ${productUrl}`;
    
    navigator.clipboard.writeText(text).then(() => {
        alert("✅ Sipariş detayı ve ürün linki panoya kopyalandı!\n\nInstagram açıldığında mesaj kutusuna basılı tutup 'Yapıştır' diyerek gönderebilirsiniz.");
        window.open('https://ig.me/m/homeucuzluk', '_blank');
    }).catch(() => {
        window.open('https://ig.me/m/homeucuzluk', '_blank');
    });
}

async function removeProduct(id) {
    if (confirm("Bu içeriği silmek istediğinize emin misiniz?")) {
        await deleteProductFromDB(id);
        renderProducts();
    }
}

function switchTab(tab) {
    if (tab === 'catalog') {
        document.getElementById('catalog-section').classList.remove('hidden');
        document.getElementById('products-section').classList.add('hidden');
    } else {
        document.getElementById('catalog-section').classList.add('hidden');
        document.getElementById('products-section').classList.remove('hidden');
    }
}
