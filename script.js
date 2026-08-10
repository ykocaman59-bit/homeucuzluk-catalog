let products = JSON.parse(localStorage.getItem('homeucuzluk_products')) || [];

document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    
    // Görsel yüklendiğinde OCR (Akıllı Metin Okuma)
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
            status.innerText = "✅ Bilgiler başarıyla tarandı ve dolduruldu!";

            // Fiyat tespiti
            const priceMatch = text.match(/(\d+[\.,]?\d*)\s*(TL|tl|₺)/);
            if (priceMatch) {
                document.getElementById('price-input').value = priceMatch[1].replace(',', '.');
            }

            // Başlık tespiti
            const lines = text.split('\n').filter(l => l.trim() !== '');
            if (lines.length > 0) {
                document.getElementById('title-input').value = lines[0].substring(0, 50);
            }
            
            document.getElementById('desc-input').value = text;

        } catch (err) {
            status.innerText = "⚠️ Otomatik okunamadı, alanları manuel doldurabilirsiniz.";
        }
    });

    // Form Gönderimi (Ürün Ekleme)
    document.getElementById('add-product-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const newProduct = {
            id: Date.now(),
            title: document.getElementById('title-input').value,
            price: document.getElementById('price-input').value,
            desc: document.getElementById('desc-input').value,
            shipping: document.getElementById('shipping-input').value,
            type: document.getElementById('type-input').value,
            expiry: document.getElementById('expiry-input').value,
            image: document.getElementById('image-preview').src
        };

        products.push(newProduct);
        localStorage.setItem('homeucuzluk_products', JSON.stringify(products));
        
        alert("Ürün başarıyla eklendi!");
        document.getElementById('add-product-form').reset();
        document.getElementById('image-preview-container').classList.add('hidden');
        document.getElementById('ocr-status').innerText = "Görsel seçildiğinde metinler taranacaktır...";
        renderProducts();
    });
});

// Ürünleri Listeleme ve Otomatik/Manuel Yönetim
function renderProducts() {
    const catalogGrid = document.getElementById('insert-grid');
    const productGrid = document.getElementById('product-grid');
    const adminList = document.getElementById('admin-product-list');
    
    catalogGrid.innerHTML = '';
    productGrid.innerHTML = '';
    adminList.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];

    products.forEach(item => {
        // Yönetim paneli listesi (Süresi geçse bile admin görebilsin ve silsin diye burada listelenir)
        const adminItem = document.createElement('div');
        adminItem.className = 'admin-item';
        adminItem.innerHTML = `
            <span><b>${item.title}</b> (${item.price} ₺) - Bitiş: ${item.expiry}</span>
            <button class="delete-btn" onclick="deleteProduct(${item.id})">Sil / Kaldır</button>
        `;
        adminList.appendChild(adminItem);

        // Tarihi geçmiş ürünleri yayından otomatik gizle
        if (item.expiry < today) return;

        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Instagram DM otomatik mesaj bağlantısı
        const dmMessage = encodeURIComponent(`Merhaba, "${item.title}" (${item.price} ₺) ürününüzü sipariş etmek istiyorum. Kargo durumu: ${item.shipping}`);
        const instagramDmUrl = `https://ig.me/m/homeucuzluk?text=${dmMessage}`;

        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}">
            <div class="product-info">
                <h3>${item.title}</h3>
                <div class="price-tag">${item.price} ₺</div>
                <p style="white-space: pre-line; font-size: 0.9rem;">${item.desc}</p>
                <span class="badge badge-shipping">${item.shipping}</span>
                <div class="expiry-tag">⏱️ Son Geçerlilik: ${item.expiry}</div>
                <a href="${instagramDmUrl}" target="_blank" class="dm-btn">💬 Instagram DM ile Sipariş Ver</a>
            </div>
        `;

        if (item.type === 'insert') {
            catalogGrid.appendChild(card);
        } else {
            productGrid.appendChild(card);
        }
    });
}

// Ürün Silme / Erken Kaldırma Fonksiyonu
function deleteProduct(id) {
    if (confirm("Bu ürünü/inserti yayından kaldırmak istediğinizden emin misiniz?")) {
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
    document.getElementById('admin-panel').classList.toggle('hidden');
}
