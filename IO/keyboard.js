let keypressed = false;
const rows = 4;
const cols = 9;
let cellWidth;
let cellHeight;
let row;
let col;

let image;

window.onload = function () {
    image = document.getElementById('keyboard-image');
    const imageContainer = document.querySelector('.image-container');
    if (image) {
        cellWidth = image.width / cols;
        cellHeight = image.height / rows;
        for (let row1 = 0; row1 < rows; row1++) {
            for (let col1 = 0; col1 < cols; col1++) {
                const cell = document.createElement('div');
                cell.style.left = `${col1 * cellWidth}px`;
                cell.style.top = `${row1 * cellHeight}px`;
                cell.style.width = `${cellWidth}px`;
                cell.style.height = `${cellHeight}px`;
                imageContainer.appendChild(cell);
            }
        }
        moveCircle(0, 0, 0);
    }
    else {
        console.error('Image element not found!');
    }
    image.addEventListener('click', function (event) {
        keypressed = true;
        col = Math.floor(event.offsetX / cellWidth);
        row = Math.floor(event.offsetY / cellHeight);
        moveCircle((col + 0.5) * cellWidth, (row + .5) * cellHeight, 1);
        moveCircle(0, 0, 0);
    });
}