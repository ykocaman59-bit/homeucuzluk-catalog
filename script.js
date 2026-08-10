let products = JSON.parse(localStorage.getItem('homeucuzluk_products')) || [];
const ADMIN_PASSWORD = "14531453";
let aktifIndeks = 0;

document.addEventListener('DOMContentLoaded', () => {
    renderProducts();

    // Görsel Seçildiğinde Otomatik Sıkıştırma + OCR
    document.getElementById('image-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const status = document.getElementById('ocr-status');
        status.innerText = "⏳ Görsel optimize ediliyor ve okunuyor...";

        // Resim Boyutunu Küçültme (Storage Dolmasını Önler)
        const compressedImage = await compressImage(file, 800, 0.7);
        document.getElementById('image-preview').src = compressedImage;
        document.getElementById('image-preview-container').classList.remove('hidden');

        try {
            const worker = await Tesseract.createWorker('tur');
            const ret = await worker.recognize(file);
            await worker.terminate();

            const text = ret.data.text;
            status.innerText = "✅ Görsel tarandı!";

            const priceMatch = text.match(/(\d+[\.,]?\d*)\s*(TL|tl|₺)/);
            if (priceMatch) {
                document.getElementById('price-input').value = priceMatch[1].replace(',', '.');
            }

            const lines = text.split('\n').filter(l => l.trim().length > 3);
            if (lines.length > 0) {
                document.getElementById('title-input').value = lines[0].substring(0, 50);
            }
            document.getElementById('desc-input').value = text;

        } catch (err) {
            status.innerText = "⚠️ Metin okunamadı, bilgileri elle girebilirsiniz.";
        }
    });

    // Form Gönderimi
    document.getElementById('add-product-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const newProduct = {
            id: Date.now(),
            title: document.getElementById('title-input').value,
            price: document.getElementById('price-input').value,
            desc: document.getElementById('desc-input').value,
            shipping: document.getElementById('shipping-input').value,
            type: document.getElementById('type-input').value,
            startDate: document.getElementById('start-date-input').value,
            expiry: document.getElementById('expiry-input').value,
            image: document.getElementById('image-preview').src
        };

        products.push(newProduct);
        
        try {
            localStorage.setItem('homeucuzluk_products', JSON.stringify(products));
            alert("Ürün başarıyla eklendi ve kaydedildi!");
        } catch(err) {
            alert("Hafıza dolu! Lütfen eski bazı ürünleri yönetim panelinden silin.");
        }

        document.getElementById('add-product-form').reset();
        document.getElementById('image-preview-container').classList.add('hidden');
        renderProducts();
    });
});

// Resim Sıkıştırma Fonksiyonu
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

// Ürünleri Listeleme ve Ekranı Yenileme
function renderProducts() {
    const slidesContainer = document.getElementById('carouselSlides');
    const noktalarKutusu = document.getElementById('noktalarKutusu');
    const productGrid = document.getElementById('product-grid');
    const adminList = document.getElementById('admin-product-list');

    slidesContainer.innerHTML = '';
    noktalarKutusu.innerHTML = '';
    productGrid.innerHTML = '';
    adminList.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];
    let insertItems = [];

    products.forEach(item => {
        // Admin Liste
        const adminItem = document.createElement('div');
        adminItem.className = 'admin-item';
        adminItem.innerHTML = `
            <span><b>${item.title}</b> (${item.price} ₺) - [Bitiş: ${item.expiry}]</span>
            <button onclick="deleteProduct(${item.id})" style="background:#e50914; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Sil</button>
        `;
        adminList.appendChild(adminItem);

        if (item.expiry < today) return; // Tarihi geçenleri yayından kaldır

        if (item.type === 'insert') {
            insertItems.push(item);
        } else {
            // Tekil Ürün Kartı
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <img src="${item.image}" alt="${item.title}">
                <div class="product-card-body">
                    <h3>${item.title}</h3>
                    <div class="price-tag">${item.price} ₺</div>
                    <p style="font-size:0.85rem; color:#666; margin-bottom:8px;">${item.desc}</p>
                    <button onclick="orderViaInstagram('${item.title}', '${item.price}', '${item.shipping}')" class="dm-btn">
                        💬 Instagram DM ile Sipariş Et
                    </button>
                </div>
            `;
            productGrid.appendChild(card);
        }
    });

    // Katalog Slaytlarını Doldur
    if (insertItems.length > 0) {
        document.getElementById('baslangic-tarihi').innerText = insertItems[0].startDate;
        document.getElementById('bitis-tarihi').innerText = insertItems[0].expiry;

        insertItems.forEach((item, idx) => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.innerHTML = `<img src="${item.image}" alt="${item.title}">`;
            slidesContainer.appendChild(slide);

            const nokta = document.createElement('div');
            nokta.className = `nokta ${idx === 0 ? 'aktif' : ''}`;
            nokta.onclick = () => suankiSayfa(idx);
            noktalarKutusu.appendChild(nokta);
        });
    } else {
        slidesContainer.innerHTML = `
            <div class="slide">
                <div class="bos-alan-yazisi">
                    <i class="fa-regular fa-images" style="font-size: 36px; display:block; margin-bottom:8px;"></i>
                    Aktif Katalog Bulunmuyor
                </div>
            </div>
        `;
    }
}

// Katalog Slayt Değiştirme
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
    slidesContainer.style.transform = `translateX(-${aktifIndeks * 100}%)`;

    const noktalar = document.querySelectorAll('.nokta');
    noktalar.forEach((n, i) => {
        n.classList.toggle('aktif', i === aktifIndeks);
    });
}

// Instagram DM Sipariş
function orderViaInstagram(title, price, shipping) {
    const text = `Merhaba @homeucuzluk, web sitenizden şu ürünü sipariş etmek istiyorum:\n\n📦 Ürün: ${title}\n💰 Fiyat: ${price} TL\n🚚 Kargo: ${shipping}`;
    
    navigator.clipboard.writeText(text).then(() => {
        alert("✅ Sipariş bilgisi panoya kopyalandı!\n\nAçılan Instagram sayfasında mesaj alanına 'Yapıştır' diyerek gönderebilirsiniz.");
        window.open('https://www.instagram.com/direct/inbox/', '_blank');
    }).catch(() => {
        window.open('https://www.instagram.com/homeucuzluk/', '_blank');
    });
}

function deleteProduct(id) {
    if (confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
        products = products.filter(p => p.id !== id);
        localStorage.setItem('homeucuzluk_products', JSON.stringify(products));
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

function toggleAdminPanel() {
    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel.classList.contains('hidden')) {
        adminPanel.classList.add('hidden');
        return;
    }

    const inputPassword = prompt("Lütfen Yönetici Şifresini Giriniz:");
    if (inputPassword === ADMIN_PASSWORD) {
        adminPanel.classList.remove('hidden');
    } else if (inputPassword !== null) {
        alert("❌ Hatalı şifre!");
    }
}
