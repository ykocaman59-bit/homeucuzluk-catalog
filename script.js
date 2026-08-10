let products = JSON.parse(localStorage.getItem('homeucuzluk_products')) || [];

// 🔒 YÖNETİCİ ŞİFRESİ
const ADMIN_PASSWORD = "14531453"; 

document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    
    // Görsel yüklendiğinde metin okuma (OCR)
    document.getElementById('image-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('image-preview').src = event.target.result;
            document.getElementById('image-preview-container').classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        const status = document.getElementById('ocr-status');
        status.innerText = "⏳ Görsel taranıyor, bilgiler çıkarılıyor...";
        
        try {
            const worker = await Tesseract.createWorker('tur');
            const ret = await worker.recognize(file);
            await worker.terminate();

            const text = ret.data.text;
            status.innerText = "✅ Metin okuma tamamlandı!";

            // Otomatik Fiyat Yakalama
            const priceMatch = text.match(/(\d+[\.,]?\d*)\s*(TL|tl|₺)/);
            if (priceMatch) {
                document.getElementById('price-input').value = priceMatch[1].replace(',', '.');
            }

            // Otomatik Başlık Yakalama
            const lines = text.split('\n').filter(l => l.trim().length > 3);
            if (lines.length > 0) {
                document.getElementById('title-input').value = lines[0].substring(0, 50);
            }
            
            document.getElementById('desc-input').value = text;

        } catch (err) {
            status.innerText = "⚠️ Otomatik metin okunamadı, bilgileri manuel doldurabilirsiniz.";
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
        localStorage.setItem('homeucuzluk_products', JSON.stringify(products));
        
        alert("Ürün / İnsert başarıyla eklendi!");
        document.getElementById('add-product-form').reset();
        document.getElementById('image-preview-container').classList.add('hidden');
        document.getElementById('ocr-status').innerText = "";
        renderProducts();
    });
});

// Ürünleri ve Kataloğu Ekrana Basma
function renderProducts() {
    const insertCarousel = document.getElementById('insert-carousel');
    const productGrid = document.getElementById('product-grid');
    const adminList = document.getElementById('admin-product-list');
    
    insertCarousel.innerHTML = '';
    productGrid.innerHTML = '';
    adminList.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];
    let insertCount = 0;

    products.forEach(item => {
        // Admin Liste Yönetimi
        const adminItem = document.createElement('div');
        adminItem.className = 'admin-item';
        adminItem.innerHTML = `
            <span><b>${item.title}</b> (${item.price} ₺) - [Bitiş: ${item.expiry}]</span>
            <button class="delete-btn" onclick="deleteProduct(${item.id})">Sil</button>
        `;
        adminList.appendChild(adminItem);

        // Bitiş tarihi geçen ürünleri müşteri görünümünde otomatik kaldır
        if (item.expiry < today) return;

        // 1. İNSERT KATALOG MODU
        if (item.type === 'insert') {
            insertCount++;
            const pageDiv = document.createElement('div');
            pageDiv.className = 'carousel-page';
            pageDiv.innerHTML = `
                <img src="${item.image}" alt="${item.title}">
                <div class="page-footer">
                    <span>${item.title} - ${item.price} ₺</span> | 
                    <small>Geçerlilik: ${item.startDate} / ${item.expiry}</small>
                </div>
            `;
            insertCarousel.appendChild(pageDiv);
        }

        // 2. TEKİL ÜRÜN KARTLARI MODU
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}">
            <div class="product-info">
                <h3>${item.title}</h3>
                <div class="price-tag">${item.price} ₺</div>
                <p style="white-space: pre-line; font-size: 0.85rem; color: #555;">${item.desc}</p>
                <span class="badge badge-shipping">${item.shipping}</span>
                <div style="font-size: 0.75rem; color: #888; margin-bottom: 0.8rem;">⏱️ Son Tarih: ${item.expiry}</div>
                <button onclick="orderViaInstagram('${item.title}', '${item.price}', '${item.shipping}')" class="order-btn">
                    💬 Instagram DM ile Sipariş Ver
                </button>
            </div>
        `;
        productGrid.appendChild(card);
    });

    if (insertCount === 0) {
        insertCarousel.innerHTML = `<div style="text-align:center; width:100%; padding:2rem; color:#777;">Henüz aktif bir aktüel broşür/insert yüklenmedi.</div>`;
    }
}

// 📩 Sipariş Detaylarını Kopyalayıp Instagram DM Açma
function orderViaInstagram(title, price, shipping) {
    const text = `Merhaba @homeucuzluk, web sitenizden şu ürünü sipariş etmek istiyorum:\n\n📦 Ürün: ${title}\n💰 Fiyat: ${price} TL\n🚚 Kargo: ${shipping}`;
    
    // Panoya sipariş mesajını otomatik kopyala
    navigator.clipboard.writeText(text).then(() => {
        alert("✅ Sipariş detayları panoya kopyalandı!\n\nŞimdi açılan Instagram sayfasından mesaj alanına 'Yapıştır' (Paste) diyerek direkt gönderebilirsiniz.");
        window.open('https://www.instagram.com/direct/inbox/', '_blank');
    }).catch(() => {
        window.open('https://www.instagram.com/homeucuzluk/', '_blank');
    });
}

function deleteProduct(id) {
    if (confirm("Bu ürünü/inserti silmek istediğinize emin misiniz?")) {
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
