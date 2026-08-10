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
let selectedRating = 5; // Varsayılan 5 Yıldız

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
    await renderProducts();
    await renderReviews();

    // URL'den gelen ?product=ID parametresi
    const urlParams = new URLSearchParams(window.location.search);
    const targetProductId = urlParams.get('product');

    if (targetProductId) {
        openTargetProduct(targetProductId);
    }

    // OCR Taraması
    document.getElementById('image-input')?.addEventListener('change', async (e) => {
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

    // Ürün Ekleme Formu
    document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
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
            await db.collection("products").add(newProduct);
            alert("✅ Ürün başarıyla canlı veritabanına eklendi!");

            document.getElementById('add-product-form').reset();
            document.getElementById('image-preview-container').classList.add('hidden');
            await renderProducts();
        } catch (error) {
            alert("❌ Ürün eklenirken bir hata oluştu: " + error.message);
        }
    });

    // Müşteri Yorum Formu Gönderimi
    document.getElementById('add-review-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newReview = {
            createdAt: Date.now(),
            name: document.getElementById('review-name').value,
            rating: selectedRating,
            text: document.getElementById('review-text').value,
            media: document.getElementById('review-media').value || '',
            adminReply: ''
        };

        try {
            await db.collection("reviews").add(newReview);
            alert("✅ Değerlendirmeniz için teşekkür ederiz!");

            document.getElementById('add-review-form').reset();
            setRating(5);
            await renderReviews();
        } catch (error) {
            alert("❌ Yorum gönderilirken hata oluştu: " + error.message);
        }
    });
});

// Yıldız Seçme Fonksiyonu
function setRating(rating) {
    selectedRating = rating;
    const stars = document.querySelectorAll('.star-rating-input .star');
    stars.forEach((s, idx) => {
        if (idx < rating) {
            s.classList.add('selected');
        } else {
            s.classList.remove('selected');
        }
    });
}

// Yorumları Veritabanından Getirip Çizme
async function renderReviews() {
    const list = document.getElementById('reviews-list');
    if (!list) return;

    list.innerHTML = '⏳ Yorumlar yükleniyor...';

    try {
        const snapshot = await db.collection("reviews").orderBy("createdAt", "desc").get();
        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; color:#777;">Henüz değerlendirme yapılmamış. İlk yorumu siz yapın!</p>';
            return;
        }

        const isLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';

        snapshot.forEach(doc => {
            const r = doc.data();
            const id = doc.id;

            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                starsHtml += i <= r.rating ? '★' : '☆';
            }

            let mediaHtml = '';
            if (r.media) {
                if (r.media.includes('youtube') || r.media.includes('youtu.be')) {
                    mediaHtml = `<p><a href="${r.media}" target="_blank" style="color:#e50914;">▶️ Videoyu İzle</a></p>`;
                } else {
                    mediaHtml = `<img src="${r.media}" style="max-width:100%; max-height:200px; border-radius:8px; margin-top:8px;">`;
                }
            }

            let replyHtml = '';
            if (r.adminReply) {
                replyHtml = `
                    <div class="admin-reply-box">
                        <b>🏪 HomeUcuzluk Yanıtı:</b>
                        <p>${r.adminReply}</p>
                    </div>
                `;
            }

            let adminActionBtn = '';
            if (isLoggedIn) {
                adminActionBtn = `
                    <div style="margin-top:10px;">
                        <button onclick="replyToReview('${id}')" style="background:#007bff; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">💬 Yanıtla</button>
                        <button onclick="deleteReview('${id}')" style="background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:5px;">Sil</button>
                    </div>
                `;
            }

            const card = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <b>${r.name}</b>
                    <span style="color:#ffb703; font-size:1.2rem;">${starsHtml}</span>
                </div>
                <p style="color:#444; margin-bottom:8px;">${r.text}</p>
                ${mediaHtml}
                ${replyHtml}
                ${adminActionBtn}
            `;
            list.appendChild(card);
        });

    } catch (err) {
        console.error("Yorum çekme hatası:", err);
    }
}

// Yönetici Yorum Yanıtlama
async function replyToReview(id) {
    const reply = prompt("Müşteriye verilecek yanıtı yazınız:");
    if (reply) {
        await db.collection("reviews").doc(id).update({ adminReply: reply });
        alert("✅ Yanıtınız eklendi!");
        await renderReviews();
    }
}

// Yönetici Yorum Silme
async function deleteReview(id) {
    if (confirm("Bu yorumu silmek istediğinizden emin misiniz?")) {
        await db.collection("reviews").doc(id).delete();
        await renderReviews();
    }
}

function switchTab(tab) {
    const catalog = document.getElementById('catalog-section');
    const products = document.getElementById('products-section');
    const reviews = document.getElementById('reviews-section');
    const btns = document.querySelectorAll('.nav-btn');

    btns.forEach(b => b.classList.remove('active'));

    if (tab === 'catalog') {
        catalog.classList.remove('hidden');
        products.classList.add('hidden');
        reviews.classList.add('hidden');
        btns[0].classList.add('active');
    } else if (tab === 'products') {
        catalog.classList.add('hidden');
        products.classList.remove('hidden');
        reviews.classList.add('hidden');
        btns[1].classList.add('active');
    } else if (tab === 'reviews') {
        catalog.classList.add('hidden');
        products.classList.add('hidden');
        reviews.classList.remove('hidden');
        btns[2].classList.add('active');
    }
}

// --- Eski Diğer Yardımcı Fonksiyonlar ---
async function getAllProductsFromDB() {
    try {
        const snapshot = await db.collection("products").orderBy("createdAt", "desc").get();
        let products = [];
        snapshot.forEach(doc => { products.push({ id: doc.id, ...doc.data() }); });
        return products;
    } catch (error) { return []; }
}

async function deleteProductFromDB(id) {
    await db.collection("products").doc(id).delete();
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

let allProductsCache = [];

async function renderProducts() {
    const products = await getAllProductsFromDB();
    allProductsCache = products;

    const slidesContainer = document.getElementById('carouselSlides');
    const noktalarKutusu = document.getElementById('noktalarKutusu');
    const productGrid = document.getElementById('product-grid');
    const catalogProductsGrid = document.getElementById('catalog-products-grid');
    const adminList = document.getElementById('admin-product-list');
    const tabsContainer = document.getElementById('catalog-tabs');

    if(!slidesContainer) return;

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
            <span><b>${item.title}</b> (${item.price} ₺)</span>
            <button onclick="removeProduct('${item.id}')" style="background:#e50914; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Sil</button>
        `;
        adminList.appendChild(adminItem);

        if (item.type === 'insert') {
            const groupKey = `${item.startDate}_${item.expiry}`;
            if (!insertGroups[groupKey]) {
                insertGroups[groupKey] = { startDate: item.startDate, expiry: item.expiry, items: [] };
            }
            insertGroups[groupKey].items.push(item);
        } else {
            productGrid.appendChild(createProductCard(item));
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
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.innerHTML = `<img src="${item.image}" alt="${item.title}">`;
            slidesContainer.appendChild(slide);

            const nokta = document.createElement('div');
            nokta.className = `nokta ${idx === 0 ? 'aktif' : ''}`;
            nokta.onclick = () => suankiSayfa(idx);
            noktalarKutusu.appendChild(nokta);

            catalogProductsGrid.appendChild(createProductCard(item));
        });
        aktifIndeks = 0;
        suankiSayfa(0);
    }
}

function openTargetProduct(targetIdOrName) {
    const foundProduct = allProductsCache.find(p => p.id === targetIdOrName || p.title === targetIdOrName);
    if (!foundProduct) return;

    if (foundProduct.type === 'single') {
        switchTab('products');
    } else if (foundProduct.type === 'insert') {
        switchTab('catalog');
        const targetGroupKey = `${foundProduct.startDate}_${foundProduct.expiry}`;
        if (selectedCatalogGroup !== targetGroupKey) {
            selectedCatalogGroup = targetGroupKey;
            renderProducts();
        }
    }

    setTimeout(() => {
        const productCard = document.getElementById(`prod-card-${foundProduct.id}`);
        if (productCard) {
            productCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            productCard.style.boxShadow = "0 0 20px 5px #ffb703";
            setTimeout(() => { productCard.style.boxShadow = ""; }, 3000);
        }
    }, 500);
}

function createProductCard(item) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.id = `prod-card-${item.id}`;
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
        adminPanel?.classList.remove('hidden');
        if(authBtn) authBtn.innerText = "👤 Yönetici Paneli Açık";
    } else {
        adminPanel?.classList.add('hidden');
        if(authBtn) authBtn.innerText = "⚙️ Yönetim Paneli";
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
            renderReviews();
        } else if (inputPassword !== null) {
            alert("❌ Hatalı şifre!");
        }
    }
}

function logoutAdmin() {
    sessionStorage.removeItem('admin_logged_in');
    checkAuthStatus();
    renderReviews();
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
    const productUrl = `${currentUrl}?product=${productId}`;

    const text = `Merhaba @homeucuzluk, web sitenizden şu ürünü sipariş etmek istiyorum:\n\n📦 Ürün: ${title}\n💰 Fiyat: ${price} TL\n🚚 Kargo: ${shipping}\n🔗 Ürün Linki: ${productUrl}`;
    
    navigator.clipboard.writeText(text).then(() => {
        alert("✅ Sipariş detayı kopyalandı! Instagram mesaj kutusuna yapıştırabilirsiniz.");
        window.open('https://ig.me/m/homeucuzluk', '_blank');
    }).catch(() => {
        window.open('https://ig.me/m/homeucuzluk', '_blank');
    });
}

async function removeProduct(id) {
    if (confirm("Bu içeriği silmek istediğinize emin misiniz?")) {
        await deleteProductFromDB(id);
        await renderProducts();
    }
}
