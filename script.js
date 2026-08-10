const ADMIN_PASSWORD = "14531453";
let db = null;
let selectedCatalogGroup = null;
let aktifIndeks = 0;

// Tarihi GG.AA.YYYY formatına çevirir (Örn: 10.08.2026)
function formatDate(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateString;
}

function initDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open("HomeUcuzlukDB", 1);
        request.onupgradeneeded = (e) => {
            let database = e.target.result;
            if (!database.objectStoreNames.contains("products")) {
                database.createObjectStore("products", { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = () => resolve(null);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    checkAuthStatus();
    await initDB();
    renderProducts();

    const imgInput = document.getElementById('image-input');
    if (imgInput) {
        imgInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const status = document.getElementById('ocr-status');
            if (status) status.innerText = "⏳ Görsel taranıyor...";

            const compressedImage = await compressImage(file, 900, 0.75);
            const preview = document.getElementById('image-preview');
            if (preview) preview.src = compressedImage;
            
            const previewContainer = document.getElementById('image-preview-container');
            if (previewContainer) previewContainer.classList.remove('hidden');

            try {
                if (window.Tesseract) {
                    const worker = await Tesseract.createWorker('tur');
                    const ret = await worker.recognize(file);
                    await worker.terminate();

                    const text = ret.data.text.trim();
                    if (status) status.innerText = "✅ Görsel tarandı!";

                    const priceMatch = text.match(/(\d+[\.,]?\d*)\s*(TL|tl|₺)/);
                    if (priceMatch && document.getElementById('price-input')) {
                        document.getElementById('price-input').value = priceMatch[1].replace(',', '.');
                    }

                    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
                    if (lines.length > 0) {
                        if (document.getElementById('title-input')) document.getElementById('title-input').value = lines[0].substring(0, 60);
                        if (document.getElementById('desc-input')) document.getElementById('desc-input').value = lines.join(' ');
                    }
                }
            } catch (err) {
                if (status) status.innerText = "Görsel yüklendi.";
            }
        });
    }

    const addForm = document.getElementById('add-product-form');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const type = document.getElementById('type-input').value;
            const startDate = document.getElementById('start-date-input').value;
            const expiry = document.getElementById('expiry-input').value;

            if (type === 'insert' && (!startDate || !expiry)) {
                alert("Lütfen katalog için başlangıç ve bitiş tarihlerini giriniz!");
                return;
            }

            const newProduct = {
                id: Date.now(),
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

            await saveProductToDB(newProduct);
            alert("✅ Kaydedildi!");

            document.getElementById('add-product-form').reset();
            document.getElementById('image-preview-container').classList.add('hidden');
            renderProducts();
        });
    }
});

function handleAuthAction() {
    const isLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';
    const adminPanel = document.getElementById('admin-panel');

    if (isLoggedIn) {
        adminPanel.classList.toggle('hidden');
    } else {
        const inputPassword = prompt("Yönetici Şifresini Giriniz:");
        if (inputPassword === ADMIN_PASSWORD) {
            sessionStorage.setItem('admin_logged_in', 'true');
            checkAuthStatus();
            alert("✅ Yönetici girişi başarılı!");
        } else if (inputPassword !== null) {
            alert("❌ Hatalı Şifre!");
        }
    }
}

function checkAuthStatus() {
    const isLoggedIn = sessionStorage.getItem('admin_logged_in') === 'true';
    const adminPanel = document.getElementById('admin-panel');
    const authBtn = document.getElementById('auth-btn');

    if (!adminPanel || !authBtn) return;

    if (isLoggedIn) {
        adminPanel.classList.remove('hidden');
        authBtn.innerText = "👤 Yönetim Paneli (Açık)";
    } else {
        adminPanel.classList.add('hidden');
        authBtn.innerText = "⚙️ Yönetim Paneli";
    }
}

function logoutAdmin() {
    sessionStorage.removeItem('admin_logged_in');
    checkAuthStatus();
    alert("Oturum kapatıldı.");
}

function saveProductToDB(product) {
    return new Promise((resolve) => {
        if (!db) {
            let localData = JSON.parse(localStorage.getItem('backup_products')) || [];
            localData.push(product);
            localStorage.setItem('backup_products', JSON.stringify(localData));
            resolve();
            return;
        }
        const tx = db.transaction("products", "readwrite");
        const store = tx.objectStore("products");
        store.put(product);
        tx.oncomplete = () => resolve();
    });
}

function getAllProductsFromDB() {
    return new Promise((resolve) => {
        if (!db) {
            let localData = JSON.parse(localStorage.getItem('backup_products')) || [];
            resolve(localData);
            return;
        }
        const tx = db.transaction("products", "readonly");
        const store = tx.objectStore("products");
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
    });
}

function deleteProductFromDB(id) {
    return new Promise((resolve) => {
        if (!db) {
            let localData = JSON.parse(localStorage.getItem('backup_products')) || [];
            localData = localData.filter(p => p.id !== id);
            localStorage.setItem('backup_products', JSON.stringify(localData));
            resolve();
            return;
        }
        const tx = db.transaction("products", "readwrite");
        const store = tx.objectStore("products");
        store.delete(id);
        tx.oncomplete = () => resolve();
    });
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
    const catalogProductGrid = document.getElementById('catalog-product-grid');
    const productGrid = document.getElementById('product-grid');
    const adminList = document.getElementById('admin-product-list');
    const tabsContainer = document.getElementById('catalog-tabs');

    if (slidesContainer) slidesContainer.innerHTML = '';
    if (noktalarKutusu) noktalarKutusu.innerHTML = '';
    if (catalogProductGrid) catalogProductGrid.innerHTML = '';
    if (productGrid) productGrid.innerHTML = '';
    if (adminList) adminList.innerHTML = '';
    if (tabsContainer) tabsContainer.innerHTML = '';

    const insertGroups = {};

    products.forEach(item => {
        if (adminList) {
            const adminItem = document.createElement('div');
            adminItem.className = 'admin-item';
            adminItem.style.cssText = "display:flex; justify-content:space-between; margin-bottom:8px; padding:6px; background:#f9f9f9; border:1px solid #ddd;";
            adminItem.innerHTML = `
                <span><b>${item.title}</b> (${item.price} ₺) - [${item.type === 'insert' ? formatDate(item.startDate) + ' / ' + formatDate(item.expiry) : 'Tekil'}]</span>
                <button onclick="removeProduct(${item.id})" style="background:#e50914; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Sil</button>
            `;
            adminList.appendChild(adminItem);
        }

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
        } else if (productGrid) {
            const card = createProductCard(item);
            productGrid.appendChild(card);
        }
    });

    const groupKeys = Object.keys(insertGroups);
    if (groupKeys.length > 0) {
        if (!selectedCatalogGroup || !insertGroups[selectedCatalogGroup]) {
            selectedCatalogGroup = groupKeys[0];
        }

        // Üst Katalog Sekme Butonları
        groupKeys.forEach(key => {
            const group = insertGroups[key];
            if (tabsContainer) {
                const btn = document.createElement('button');
                btn.className = `catalog-tab-btn ${key === selectedCatalogGroup ? 'active' : ''}`;
                btn.innerText = `📅 ${formatDate(group.startDate)} - ${formatDate(group.expiry)}`;
                btn.onclick = () => {
                    selectedCatalogGroup = key;
                    renderProducts();
                };
                tabsContainer.appendChild(btn);
            }
        });

        const activeGroup = insertGroups[selectedCatalogGroup];
        
        // Tarih Alanlarını Güncelleme
        const bTarih = document.getElementById('baslangic-tarihi');
        const eTarih = document.getElementById('bitis-tarihi');
        if (bTarih) bTarih.innerText = formatDate(activeGroup.startDate);
        if (eTarih) eTarih.innerText = formatDate(activeGroup.expiry);

        // 1. ÜST ALAN: Katalog Sayfalarını Kaydırmalı (Slide) Yapma
        activeGroup.items.forEach((item, idx) => {
            if (slidesContainer) {
                const slide = document.createElement('div');
                slide.className = 'slide';
                slide.innerHTML = `<img src="${item.image}" alt="${item.title}">`;
                slidesContainer.appendChild(slide);
            }

            if (noktalarKutusu) {
                const nokta = document.createElement('div');
                nokta.className = `nokta ${idx === 0 ? 'aktif' : ''}`;
                nokta.onclick = () => suankiSayfa(idx);
                noktalarKutusu.appendChild(nokta);
            }

            // 2. ALT ALAN: Seçili Kataloğun Ürünlerini Sipariş Butonlu Liste Olarak Dizme
            if (catalogProductGrid) {
                const card = createProductCard(item);
                catalogProductGrid.appendChild(card);
            }
        });
        
        aktifIndeks = 0;
        suankiSayfa(0);
    } else {
        if (slidesContainer) {
            slidesContainer.innerHTML = `<div class="slide"><p style="text-align:center; padding:20px; color:#fff;">Aktif Katalog Bulunmuyor</p></div>`;
        }
    }
}

// Ürün Kartı Oluşturma (Sipariş Butonlu)
function createProductCard(item) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <img src="${item.image}" alt="${item.title}">
        <div class="product-card-body">
            <h3>${item.title}</h3>
            <div class="price-tag">${item.price} ₺</div>
            <div style="margin-bottom:8px;">
                <span class="badge badge-condition">${item.condition || 'Sıfır'}</span>
                <span class="badge badge-shipping">${item.shipping}</span>
            </div>
            <p style="font-size:0.85rem; color:#666; margin-bottom:8px;">${item.desc}</p>
            <button onclick="orderViaInstagram('${item.title}', '${item.price}', '${item.shipping}')" class="dm-btn">
                💬 Instagram DM ile Sipariş Et
            </button>
        </div>
    `;
    return card;
}

function toggleDateFields() {
    const type = document.getElementById('type-input').value;
    const dateFields = document.getElementById('date-fields');
    if (dateFields) dateFields.style.display = (type === 'single') ? 'none' : 'flex';
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
    if (slidesContainer) {
        slidesContainer.style.transform = `translateX(-${aktifIndeks * 100}%)`;
    }

    const noktalar = document.querySelectorAll('.nokta');
    noktalar.forEach((n, i) => {
        n.classList.toggle('aktif', i === aktifIndeks);
    });
}

function orderViaInstagram(title, price, shipping) {
    const text = `Merhaba @homeucuzluk, web sitenizden şu ürünü sipariş etmek istiyorum:\n\n📦 Ürün: ${title}\n💰 Fiyat: ${price} TL\n🚚 Kargo: ${shipping}`;
    
    navigator.clipboard.writeText(text).then(() => {
        alert("✅ Sipariş bilgisi kopyalandı!\n\nInstagram açıldığında mesaj kutusuna yapıştırabilirsiniz.");
        window.open('https://www.instagram.com/direct/inbox/', '_blank');
    }).catch(() => {
        window.open('https://www.instagram.com/homeucuzluk/', '_blank');
    });
}

async function removeProduct(id) {
    if (confirm("Bu ürünü silmek istediğinize emin misiniz?")) {
        await deleteProductFromDB(id);
        renderProducts();
    }
}

function switchTab(tab) {
    const catSec = document.getElementById('catalog-section');
    const prodSec = document.getElementById('products-section');
    if (catSec && prodSec) {
        if (tab === 'catalog') {
            catSec.classList.remove('hidden');
            prodSec.classList.add('hidden');
        } else {
            catSec.classList.add('hidden');
            prodSec.classList.remove('hidden');
        }
    }
}
