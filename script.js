let products = JSON.parse(localStorage.getItem('homeucuzluk_products')) || [];

document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    
    // Görsel yüklendiğinde Tesseract.js (OCR) ile metin okuma
    document.getElementById('image-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Önizleme
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('image-preview').src = event.target.result;
            document.getElementById('image-preview-container').classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        // OCR Tarama Başlat
        const status = document.getElementById('ocr-status');
        status.innerText = "⏳ Görsel taranıyor ve metinler okunuyor...";
        
        try {
            const worker = await Tesseract.createWorker('tur');
            const ret = await worker.recognize(file);
            await worker.terminate();

            const text = ret.data.text;
            status.innerText = "✅ Metin taranıp form alanlarına yüklendi!";

            // Fiyat tespiti (Örn: 150 TL veya 150,00 mantığı)
            const priceMatch = text.match(/(\d+[\.,]?\d*)\s*(TL|tl|₺)/);
            if (priceMatch) {
                document.getElementById('price-input').value = priceMatch[1].replace(',', '.');
            }

            // Metnin ilk satırını başlık olarak al
            const lines = text.split('\n').filter(l => l.trim() !== '');
            if (lines.length > 0) {
                document.getElementById('title-input').value = lines[0].substring(0, 50);
            }
            
            // Tam metni açıklamaya yaz
            document.getElementById('desc-input').value = text;

        } catch (err) {
            status.innerText = "⚠️ Metin okunamadı, bilgileri manuel giriniz.";
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
            expiry: document.getElementById('expiry-input').value,
            image: document.getElementById('image-preview').src
        };

        products.push(newProduct);
        localStorage.setItem('homeucuzluk_products', JSON.stringify(products));
        
        alert("Ürün / İnsert başarıyla eklendi!");
        document.getElementById('add-product-form').reset();
        document.getElementById('image-preview-container').classList.add('hidden');
        renderProducts();
    });
});

// Ürün ve İnsertleri Ekrana Basma ve Tarih Kontrolü
function renderProducts() {
    const catalogGrid = document.getElementById('insert-grid');
    const productGrid = document.getElementById('product-grid');
    
    catalogGrid.innerHTML = '';
    productGrid.innerHTML = '';

    const today = new Date().toISOString().split('T')[0];

    products.forEach(item => {
        // Tarihi geçmiş ürünleri otomatik gizle
        if (item.expiry < today) return;

        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Sipariş linki (Instagram yönlendirmesi)
        const instagramUrl = `https://www.instagram.com/homeucuzluk`;

        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}">
            <div class="product-info">
                <h3>${item.title}</h3>
                <div class="price-tag">${item.price} ₺</div>
                <p>${item.desc}</p>
                <span class="badge badge-shipping">${item.shipping}</span>
                <div class="expiry-tag">⏱️ Son Geçerlilik: ${item.expiry}</div>
                <a href="${instagramUrl}" target="_blank" class="buy-btn">Instagram'dan Sipariş Et</a>
            </div>
        `;

        if (item.type === 'insert') {
            catalogGrid.appendChild(card);
        } else {
            productGrid.appendChild(card);
        }
    });
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

