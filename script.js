const pdfUpload = document.getElementById('pdf-upload');
const uploadSection = document.getElementById('upload-section');
const pageList = document.getElementById('page-list');
const mergeBtn = document.getElementById('merge-btn');
const downloadLink = document.getElementById('download-link');

let pagesArray = [];
const pdfCache = new Map();
let pageIdCounter = 0;

const sortable = new Sortable(pageList, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    scroll: true, // Habilita a rolagem automática ao arrastar
    scrollSensitivity: 100, // Aumenta a sensibilidade para detectar quando o mouse ultrapassa os limites da lista
    scrollSpeed: 10, // Define uma velocidade constante e suave de rolagem
    bubbleScroll: true, // Permite a rolagem quando o mouse ultrapassa os limites da área de visualização
    onEnd: function (evt) {
        const newOrder = Array.from(pageList.children).map(child => parseInt(child.getAttribute('data-id')));
        const newPagesArray = newOrder.map(id => pagesArray.find(page => page.id === id)).filter(page => page !== undefined);
        pagesArray = newPagesArray;
    }
});

function updatePageList() {
    pageList.innerHTML = '';
    pagesArray.forEach((page) => {
        const div = document.createElement('div');
        div.classList.add('page-item');
        div.setAttribute('data-id', page.id);
        div.setAttribute('draggable', 'false');
        div.innerHTML = `
            <img src="${page.thumbnail}" alt="Página ${page.pageNumber}" draggable="false">
            <div class="page-info">${page.fileName} - Página ${page.pageNumber}</div>
            <button class="remove-btn" onclick="removePage(${page.id})">&times;</button>
        `;
        pageList.appendChild(div);
    });

    if (pagesArray.length > 0) {
        pageList.style.display = 'grid';
    } else {
        pageList.style.display = 'none';
    }
}

function removePage(id) {
    pagesArray = pagesArray.filter(page => page.id !== id);
    updatePageList();
}

pdfUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type === 'application/pdf') {
            processPDF(file);
        }
    });
    pdfUpload.value = '';
});

uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadSection.classList.add('dragover');
});

uploadSection.addEventListener('dragleave', () => {
    uploadSection.classList.remove('dragover');
});

uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadSection.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
        if (file.type === 'application/pdf') {
            processPDF(file);
        }
    });
});

async function processPDF(file) {
    try {
        const arrayBufferOriginal = await file.arrayBuffer();
        const bufferForPDFJS = arrayBufferOriginal.slice(0);
        const bufferForPDFLib = arrayBufferOriginal.slice(0);

        const pdf = await pdfjsLib.getDocument({ data: bufferForPDFJS }).promise;
        const numPages = pdf.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                const scale = 0.2;
                const scaledViewport = page.getViewport({ scale: scale });
                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;

                await page.render({ canvasContext: context, viewport: scaledViewport }).promise;

                const thumbnail = canvas.toDataURL();

                pagesArray.push({
                    id: pageIdCounter++,
                    fileName: file.name,
                    pageNumber: pageNum,
                    pdfBuffer: bufferForPDFLib,
                    pageIndex: pageNum - 1,
                    thumbnail: thumbnail
                });

                updatePageList();
            } catch (error) {
                console.error(`Erro ao processar a página ${pageNum} do arquivo ${file.name}:`, error);
                alert(`Erro ao processar a página ${pageNum} do arquivo ${file.name}. Veja o console para mais detalhes.`);
            }
        }
    } catch (error) {
        console.error(`Erro ao carregar o arquivo ${file.name}:`, error);
        alert(`Erro ao carregar o arquivo ${file.name}. Veja o console para mais detalhes.`);
    }
}

mergeBtn.addEventListener('click', async () => {
    if (pagesArray.length < 2) {
        alert('Por favor, adicione pelo menos duas páginas para mesclar.');
        return;
    }

    mergeBtn.disabled = true;
    mergeBtn.textContent = 'Mesclando...';
    downloadLink.style.display = 'none';

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const page of pagesArray) {
            if (!pdfCache.has(page.fileName)) {
                const pdfDoc = await PDFLib.PDFDocument.load(page.pdfBuffer.slice(0));
                pdfCache.set(page.fileName, pdfDoc);
            }
        }

        for (const page of pagesArray) {
            const pdfDoc = pdfCache.get(page.fileName);
            if (!pdfDoc) {
                throw new Error(`PDF não encontrado no cache: ${page.fileName}`);
            }
            const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [page.pageIndex]);
            mergedPdf.addPage(copiedPage);
        }

        const mergedPdfFile = await mergedPdf.save();
        const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        downloadLink.href = url;
        downloadLink.style.display = 'block';
    } catch (error) {
        console.error('Erro ao mesclar PDFs:', error);
        alert(`Ocorreu um erro ao mesclar os PDFs: ${error.message}`);
    } finally {
        mergeBtn.disabled = false;
        mergeBtn.textContent = 'Unir PDFs';
    }
});

window.removePage = removePage;
