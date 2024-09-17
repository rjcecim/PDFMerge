// Importa a biblioteca pdf.js do arquivo local
import * as pdfjsLib from './libs/pdf.min.mjs';

// Define o caminho para o worker (trabalhador) do pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = './libs/pdf.worker.min.mjs';

// Seleciona os elementos HTML para interação
const pdfUpload = document.getElementById('pdf-upload');
const uploadSection = document.getElementById('upload-section');
const pageList = document.getElementById('page-list');
const mergeBtn = document.getElementById('merge-btn');
const downloadLink = document.getElementById('download-link');

const modal = document.getElementById('modal');
const modalCanvas = document.getElementById('modal-canvas');
const closeBtn = document.querySelector('.close-btn');

let pagesArray = []; // Array para armazenar as páginas dos PDFs
const pdfFiles = new Map(); // Mapa para armazenar os PDFs carregados
let pageIdCounter = 0; // Contador para IDs únicos de páginas
let fileIdCounter = 1; // Contador para IDs únicos de arquivos

// Inicializa a funcionalidade de arrastar e soltar usando Sortable.js
const sortable = new Sortable(pageList, {
    animation: 150,
    ghostClass: 'sortable-ghost', // Classe CSS aplicada ao item durante a movimentação
    scroll: true,
    scrollSensitivity: 100, // Sensibilidade da rolagem
    scrollSpeed: 10, // Velocidade da rolagem
    bubbleScroll: true, // Permite rolagem em elementos pai
    onEnd: function (evt) {
        // Atualiza a ordem das páginas no array quando o usuário solta um item
        const newOrder = Array.from(pageList.children).map(child => parseInt(child.getAttribute('data-id')));
        const newPagesArray = newOrder.map(id => pagesArray.find(page => page.id === id)).filter(page => page !== undefined);
        pagesArray = newPagesArray;
    }
});

// Função para atualizar a lista de miniaturas das páginas
function updatePageList() {
    pageList.innerHTML = ''; // Limpa a lista antes de atualizar
    pagesArray.forEach((page) => {
        const div = document.createElement('div');
        div.classList.add('page-item');
        div.setAttribute('data-id', page.id);
        div.setAttribute('draggable', 'false'); // Evita que a miniatura seja arrastada individualmente
        div.innerHTML = `
            <img src="${page.thumbnail}" alt="Page ${page.pageNumber}" draggable="false">
            <div class="page-info">${page.fileDisplayName} - Page ${page.pageNumber}</div>
            <button class="remove-btn" onclick="removePage(${page.id})">&times;</button>
        `;
        pageList.appendChild(div); // Adiciona a miniatura à lista

        // Adiciona evento de duplo clique para abrir o modal
        div.addEventListener('dblclick', () => {
            openModal(page);
        });
    });

    // Mostra ou oculta a lista dependendo se há páginas no array
    if (pagesArray.length > 0) {
        pageList.style.display = 'grid';
    } else {
        pageList.style.display = 'none';
    }
}

// Função para abrir o modal e renderizar a página selecionada
async function openModal(page) {
    modal.classList.add('open'); // Exibe o modal

    const context = modalCanvas.getContext('2d');

    // Limpa o canvas
    context.clearRect(0, 0, modalCanvas.width, modalCanvas.height);

    try {
        let fileData = pdfFiles.get(page.fileId);

        // Carrega o documento pdf.js se ainda não estiver carregado
        if (!fileData.pdfjsDoc) {
            fileData.pdfjsDoc = await pdfjsLib.getDocument({ data: fileData.pdfBuffer.slice(0) }).promise;
        }

        const pdfPage = await fileData.pdfjsDoc.getPage(page.pageNumber);
        const viewport = pdfPage.getViewport({ scale: 1 });

        // Calcula a escala para ajustar a página no modal
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

        await pdfPage.render(renderContext).promise; // Renderiza a página no canvas
    } catch (error) {
        console.error('Erro ao renderizar a página no modal:', error);
        alert(`Erro ao renderizar a página. Veja o console para detalhes.`);
    }
}

// Evento para fechar o modal ao clicar no botão de fechar
closeBtn.addEventListener('click', () => {
    modal.classList.remove('open');
});

// Fecha o modal ao clicar fora do conteúdo
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('open');
    }
});

// Função para remover uma página do array
function removePage(id) {
    pagesArray = pagesArray.filter(page => page.id !== id); // Remove a página com o ID correspondente
    updatePageList(); // Atualiza a lista após a remoção
}

// Torna a função removePage acessível globalmente
window.removePage = removePage;

// Evento para lidar com o upload de arquivos via input
pdfUpload.addEventListener('change', (e) => {
    const files = Array.from(e.target.files); // Converte os arquivos carregados em um array
    files.forEach(file => {
        if (file.type === 'application/pdf') {
            processPDF(file); // Processa o arquivo PDF
        }
    });
    pdfUpload.value = ''; // Limpa o input após o upload
});

// Evento para lidar com o arraste de arquivos sobre a área de upload
uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault(); // Previne o comportamento padrão do navegador
    uploadSection.classList.add('dragover'); // Adiciona a classe de estilo ao arrastar
});

// Evento para remover o estilo de arraste quando o mouse sai da área de upload
uploadSection.addEventListener('dragleave', () => {
    uploadSection.classList.remove('dragover'); // Remove a classe de estilo
});

// Evento para lidar com o drop de arquivos na área de upload
uploadSection.addEventListener('drop', (e) => {
    e.preventDefault(); // Previne o comportamento padrão do navegador
    uploadSection.classList.remove('dragover'); // Remove o estilo de arraste
    const files = Array.from(e.dataTransfer.files); // Obtém os arquivos soltos
    files.forEach(file => {
        if (file.type === 'application/pdf') {
            processPDF(file); // Processa o arquivo PDF
        }
    });
});

// Função para processar e exibir as páginas do PDF
async function processPDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer(); // Carrega o conteúdo do arquivo PDF
        const bufferForPDFJS = arrayBuffer.slice(0); // Cria um buffer para pdf.js
        const bufferForPDFLib = arrayBuffer.slice(0); // Cria um buffer para PDFLib

        // Armazena o buffer no mapa pdfFiles
        const fileId = pageIdCounter++;
        const fileDisplayName = `File ${fileIdCounter++}`; // Atribui um nome curto ao arquivo
        pdfFiles.set(fileId, {
            fileName: file.name,
            fileDisplayName: fileDisplayName, // Armazena o nome curto
            pdfBuffer: bufferForPDFLib,
            numPages: 0,
            pdfDoc: null, // Para documento PDFLib
            pdfjsDoc: null // Para documento pdf.js
        });

        const loadingTask = pdfjsLib.getDocument({ data: bufferForPDFJS });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        // Atualiza o número de páginas
        pdfFiles.get(fileId).numPages = numPages;

        // Itera sobre cada página do PDF
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                const scale = 0.2; // Define a escala da miniatura
                const scaledViewport = page.getViewport({ scale: scale });
                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: scaledViewport
                };

                await page.render(renderContext).promise; // Renderiza a página no canvas

                const thumbnail = canvas.toDataURL(); // Gera a miniatura como uma URL de dados

                // Adiciona a página processada ao array de páginas
                pagesArray.push({
                    id: pageIdCounter++,
                    fileId: fileId,
                    fileName: file.name,
                    fileDisplayName: fileDisplayName, // Usa o nome curto
                    pageNumber: pageNum,
                    pageIndex: pageNum - 1,
                    thumbnail: thumbnail
                });

                updatePageList(); // Atualiza a lista de miniaturas
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

// Evento ao clicar no botão de mesclar PDFs
mergeBtn.addEventListener('click', async () => {
    if (pagesArray.length < 2) {
        alert('Adicione pelo menos duas páginas para mesclar.'); // Verifica se há páginas suficientes
        return;
    }

    mergeBtn.disabled = true; // Desativa o botão durante a mesclagem
    mergeBtn.textContent = 'Merging...'; // Altera o texto do botão para indicar o processo
    downloadLink.style.display = 'none'; // Oculta o link de download

    try {
        const mergedPdf = await PDFLib.PDFDocument.create(); // Cria um novo documento PDF vazio

        // Copia e adiciona cada página ao PDF mesclado
        for (const page of pagesArray) {
            let fileData = pdfFiles.get(page.fileId);

            // Carrega o documento PDFLib se ainda não estiver carregado
            if (!fileData.pdfDoc) {
                fileData.pdfDoc = await PDFLib.PDFDocument.load(fileData.pdfBuffer.slice(0));
            }

            const [copiedPage] = await mergedPdf.copyPages(fileData.pdfDoc, [page.pageIndex]); // Copia a página do PDF
            mergedPdf.addPage(copiedPage); // Adiciona a página ao novo PDF
        }

        const mergedPdfFile = await mergedPdf.save(); // Salva o PDF mesclado como um array de bytes
        const blob = new Blob([mergedPdfFile], { type: 'application/pdf' }); // Cria um blob a partir do PDF
        const url = URL.createObjectURL(blob); // Gera uma URL para download

        downloadLink.href = url; // Define a URL no link de download
        downloadLink.style.display = 'block'; // Exibe o link de download
    } catch (error) {
        console.error('Erro ao mesclar os PDFs:', error);
        alert(`Erro ao mesclar os PDFs: ${error.message}`);
    } finally {
        mergeBtn.disabled = false; // Reativa o botão após o processo
        mergeBtn.textContent = 'Merge PDFs'; // Restaura o texto original do botão
    }
});