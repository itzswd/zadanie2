(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.QRCodeGenerator = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    function createQRCodeSVG(text, size = 180) {
        const moduleCount = 25; 
        const matrix = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(0));
        function setFinderPattern(startX, startY) {
            for (let y = 0; y < 7; y++) {
                for (let x = 0; x < 7; x++) {
                    if (
                        y === 0 || y === 6 || x === 0 || x === 6 || 
                        (y >= 2 && y <= 4 && x >= 2 && x <= 4)      
                    ) {
                        matrix[startY + y][startX + x] = 1;
                    } else {
                        matrix[startY + y][startX + x] = 0;
                    }
                }
            }
        }
        setFinderPattern(0, 0);                         
        setFinderPattern(moduleCount - 7, 0);           
        setFinderPattern(0, moduleCount - 7);           
        for (let i = 0; i < 8; i++) {
            if (i < moduleCount) {
                if (7 < moduleCount) matrix[7][i] = 0;
                if (7 < moduleCount) matrix[i][7] = 0;
                if (moduleCount - 8 >= 0) {
                    matrix[7][moduleCount - 1 - i] = 0;
                    matrix[i][moduleCount - 8] = 0;
                    matrix[moduleCount - 8][i] = 0;
                    matrix[moduleCount - 1 - i][7] = 0;
                }
            }
        }
        for (let i = 8; i < moduleCount - 8; i++) {
            matrix[6][i] = i % 2 === 0 ? 1 : 0;
            matrix[i][6] = i % 2 === 0 ? 1 : 0;
        }
        const alignX = 18, alignY = 18;
        for (let y = -2; y <= 2; y++) {
            for (let x = -2; x <= 2; x++) {
                if (Math.abs(x) === 2 || Math.abs(y) === 2 || (x === 0 && y === 0)) {
                    matrix[alignY + y][alignX + x] = 1;
                } else {
                    matrix[alignY + y][alignX + x] = 0;
                }
            }
        }
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }
        let seed = Math.abs(hash) || 1234567;
        function randomBit() {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed >> 16) % 2;
        }
        for (let y = 0; y < moduleCount; y++) {
            for (let x = 0; x < moduleCount; x++) {
                const inTopLeft = (x <= 7 && y <= 7);
                const inTopRight = (x >= moduleCount - 8 && y <= 7);
                const inBottomLeft = (x <= 7 && y >= moduleCount - 8);
                const inTiming = (x === 6 || y === 6);
                const inAlign = (x >= 16 && x <= 20 && y >= 16 && y <= 20);
                if (!inTopLeft && !inTopRight && !inBottomLeft && !inTiming && !inAlign) {
                    matrix[y][x] = randomBit();
                }
            }
        }
        const cellSize = size / (moduleCount + 2);
        let rects = '';
        for (let y = 0; y < moduleCount; y++) {
            for (let x = 0; x < moduleCount; x++) {
                if (matrix[y][x] === 1) {
                    const rx = ((x + 1) * cellSize).toFixed(2);
                    const ry = ((y + 1) * cellSize).toFixed(2);
                    const rw = (cellSize + 0.1).toFixed(2);
                    rects += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rw}" fill="#0f172a" />`;
                }
            }
        }
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#ffffff; border-radius: 8px; padding: 4px;">
                <rect width="100%" height="100%" fill="#ffffff" />
                ${rects}
            </svg>
        `;
    }
    return {
        createSVG: createQRCodeSVG
    };
}));
