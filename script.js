import * as pdfjsLib from './libs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './libs/pdf.worker.min.mjs';

const pdfUpload = document.getElementById('pdf-upload');
const uploadSection = document.getElementById('upload-section');
const pageList = document.getElementById('page-list');
const mergeBtn = document.getElementById('merge-btn');
const downloadLink = document.getElementById('download-link');

const modal = document.getElementById('modal');
const modalCanvas = document.getElementById('modal-canvas');
const closeBtn = document.querySelector('.close-btn');

let pagesArray = [];
const pdfFiles = new Map();
let pageIdCounter = 0;
let fileIdCounter = 1;

const sortable = new Sortable(pageList, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    scroll: true,
    scrollSensitivity: 100,
    scrollSpeed: 10,
    bubbleScroll: true,
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

        // Estrutura HTML atualizada com sobreposição de botões e labels
        div.innerHTML = `
            <div class="thumbnail-container">
                <img src="${page.thumbnail}" alt="Página ${page.pageNumber}" draggable="false" class="page-thumbnail" style="transform: rotate(${page.rotation}deg);">
                <div class="overlay-buttons">
                    <button class="remove-btn" aria-label="Remover Página">&times;</button>
                    <button class="rotate-btn rotate-left" aria-label="Girar Página para a Esquerda">⟲</button>
                    <button class="rotate-btn rotate-right" aria-label="Girar Página para a Direita">⟳</button>
                </div>
            </div>
            <div class="page-info">
                <span class="file-name">${page.fileDisplayName}</span> - 
                <span class="page-number">Página ${page.pageNumber}</span>
            </div>
        `;
        pageList.appendChild(div);

        // Adiciona eventos aos botões
        div.querySelector('.remove-btn').addEventListener('click', () => removePage(page.id));
        div.querySelector('.rotate-left').addEventListener('click', () => rotatePage(page.id, -90));
        div.querySelector('.rotate-right').addEventListener('click', () => rotatePage(page.id, 90));

        // Evento de duplo clique para abrir o modal
        div.addEventListener('dblclick', () => {
            openModal(page);
        });
    });

    pageList.style.display = pagesArray.length > 0 ? 'grid' : 'none';
}

function rotatePage(pageId, angle) {
    const page = pagesArray.find(p => p.id === pageId);
    if (page) {
        // Atualiza o ângulo de rotação
        page.rotation = (page.rotation + angle) % 360;

        // Atualiza a miniatura visualmente
        const pageElement = document.querySelector(`[data-id='${pageId}'] .page-thumbnail`);
        if (pageElement) {
            pageElement.style.transform = `rotate(${page.rotation}deg)`;
        }
    }
}

async function openModal(page) {
    modal.classList.add('open');

    const context = modalCanvas.getContext('2d');

    context.clearRect(0, 0, modalCanvas.width, modalCanvas.height);

    try {
        let fileData = pdfFiles.get(page.fileId);

        if (!fileData.pdfjsDoc) {
            fileData.pdfjsDoc = await pdfjsLib.getDocument({ data: fileData.pdfBuffer.slice(0) }).promise;
        }

        const pdfPage = await fileData.pdfjsDoc.getPage(page.pageNumber);
        const viewport = pdfPage.getViewport({ scale: 1 });

        const scale = Math.min(
            (modalCanvas.parentElement.clientWidth - 40) / viewport.width,
            (modalCanvas.parentElement.clientHeight - 40) / viewport.height
        );

        const scaledViewport = pdfPage.getViewport({ scale: scale });
        modalCanvas.width = scaledViewport.width;
        modalCanvas.height = scaledViewport.height;

        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };

        await pdfPage.render(renderContext).promise;
    } catch (error) {
        console.error('Erro ao renderizar a página no modal:', error);
        alert(`Erro ao renderizar a página. Veja o console para detalhes.`);
    }
}

closeBtn.addEventListener('click', () => {
    modal.classList.remove('open');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('open');
    }
});

function removePage(id) {
    pagesArray = pagesArray.filter(page => page.id !== id);
    updatePageList();
}

window.removePage = removePage;

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
        const arrayBuffer = await file.arrayBuffer();
        const bufferForPDFJS = arrayBuffer.slice(0);
        const bufferForPDFLib = arrayBuffer.slice(0);

        const fileId = pageIdCounter++;
        const fileDisplayName = `Arquivo ${fileIdCounter++}`;
        pdfFiles.set(fileId, {
            fileName: file.name,
            fileDisplayName: fileDisplayName,
            pdfBuffer: bufferForPDFLib,
            numPages: 0,
            pdfDoc: null,
            pdfjsDoc: null
        });

        const loadingTask = pdfjsLib.getDocument({ data: bufferForPDFJS });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        pdfFiles.get(fileId).numPages = numPages;

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

                const renderContext = {
                    canvasContext: context,
                    viewport: scaledViewport
                };

                await page.render(renderContext).promise;

                const thumbnail = canvas.toDataURL();

                pagesArray.push({
                    id: pageIdCounter++,
                    fileId: fileId,
                    fileName: file.name,
                    fileDisplayName: fileDisplayName,
                    pageNumber: pageNum,
                    pageIndex: pageNum - 1,
                    thumbnail: thumbnail,
                    rotation: 0 // Ângulo de rotação inicial
                });

                updatePageList();
            } catch (error) {
                console.error(`Erro ao processar a página ${pageNum} do arquivo ${file.name}:`, error);
                alert(`Erro ao processar a página ${pageNum} do arquivo ${file.name}. Veja o console para detalhes.`);
            }
        }
    } catch (error) {
        console.error(`Erro ao carregar o arquivo ${file.name}:`, error);
        alert(`Erro ao carregar o arquivo ${file.name}. Veja o console para detalhes.`);
    }
}

mergeBtn.addEventListener('click', async () => {
    if (pagesArray.length < 2) {
        alert('Adicione pelo menos duas páginas para mesclar.');
        return;
    }

    mergeBtn.disabled = true;
    mergeBtn.textContent = 'Mesclando...';
    downloadLink.style.display = 'none';

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const page of pagesArray) {
            let fileData = pdfFiles.get(page.fileId);

            if (!fileData.pdfDoc) {
                fileData.pdfDoc = await PDFLib.PDFDocument.load(fileData.pdfBuffer.slice(0));
            }

            const [copiedPage] = await mergedPdf.copyPages(fileData.pdfDoc, [page.pageIndex]);

            // Aplica a rotação se não for zero
            if (page.rotation !== 0) {
                copiedPage.setRotation(PDFLib.degrees(page.rotation));
            }

            mergedPdf.addPage(copiedPage);
        }

        const mergedPdfFile = await mergedPdf.save();
        const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        downloadLink.href = url;
        downloadLink.style.display = 'block';
    } catch (error) {
        console.error('Erro ao mesclar os PDFs:', error);
        alert(`Erro ao mesclar os PDFs: ${error.message}`);
    } finally {
        mergeBtn.disabled = false;
        mergeBtn.textContent = 'Mesclar PDFs';
    }
});
