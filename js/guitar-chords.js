// Guitar Chord Diagrams Database
// Format: [fret, finger] for each string (6th to 1st string)
// -1 = muted (x), 0 = open, 1-4 = fret numbers

const GUITAR_CHORDS = {
    // Major chords
    'C': { fingers: [[-1, 0], [3, 3], [2, 2], [0, 0], [1, 1], [0, 0]], name: 'C Major' },
    'D': { fingers: [[-1, 0], [-1, 0], [0, 0], [2, 1], [3, 3], [2, 2]], name: 'D Major' },
    'E': { fingers: [[0, 0], [2, 2], [2, 3], [1, 1], [0, 0], [0, 0]], name: 'E Major' },
    'F': { fingers: [[1, 1], [3, 4], [3, 3], [2, 2], [1, 1], [1, 1]], name: 'F Major' },
    'G': { fingers: [[3, 2], [2, 1], [0, 0], [0, 0], [0, 0], [3, 3]], name: 'G Major' },
    'A': { fingers: [[-1, 0], [0, 0], [2, 1], [2, 2], [2, 3], [0, 0]], name: 'A Major' },
    'B': { fingers: [[-1, 0], [2, 1], [4, 3], [4, 4], [4, 2], [2, 1]], name: 'B Major' },
    
    // Minor chords
    'Cm': { fingers: [[-1, 0], [3, 2], [5, 4], [5, 3], [4, 1], [3, 1]], name: 'C Minor' },
    'Dm': { fingers: [[-1, 0], [-1, 0], [0, 0], [2, 2], [3, 3], [1, 1]], name: 'D Minor' },
    'Em': { fingers: [[0, 0], [2, 2], [2, 3], [0, 0], [0, 0], [0, 0]], name: 'E Minor' },
    'Fm': { fingers: [[1, 1], [3, 3], [3, 4], [1, 1], [1, 1], [1, 1]], name: 'F Minor' },
    'Gm': { fingers: [[3, 1], [5, 3], [5, 4], [3, 1], [3, 1], [3, 1]], name: 'G Minor' },
    'Am': { fingers: [[-1, 0], [0, 0], [2, 2], [2, 3], [1, 1], [0, 0]], name: 'A Minor' },
    'Bm': { fingers: [[-1, 0], [2, 1], [4, 3], [4, 4], [3, 2], [2, 1]], name: 'B Minor' },
    
    // Seventh chords
    'C7': { fingers: [[-1, 0], [3, 3], [2, 2], [3, 4], [1, 1], [0, 0]], name: 'C7' },
    'D7': { fingers: [[-1, 0], [-1, 0], [0, 0], [2, 2], [1, 1], [2, 3]], name: 'D7' },
    'E7': { fingers: [[0, 0], [2, 2], [0, 0], [1, 1], [0, 0], [0, 0]], name: 'E7' },
    'G7': { fingers: [[3, 3], [2, 2], [0, 0], [0, 0], [0, 0], [1, 1]], name: 'G7' },
    'A7': { fingers: [[-1, 0], [0, 0], [2, 2], [0, 0], [2, 3], [0, 0]], name: 'A7' },
    
    // Default/Unknown
    'Unknown': { fingers: [[-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0]], name: 'Unknown' }
};

class GuitarChordDiagram {
    constructor(chord) {
        this.chord = chord;
        this.chordData = GUITAR_CHORDS[chord] || GUITAR_CHORDS['Unknown'];
        this.width = 100;
        this.height = 140;
        this.frets = 5;
        this.strings = 6;
        this.fretWidth = 60;
        this.fretHeight = 20;
        this.margin = 20;
    }
    
    render() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', this.width);
        svg.setAttribute('height', this.height);
        svg.setAttribute('class', 'fretboard');
        
        // Draw frets (horizontal lines)
        for (let i = 0; i <= this.frets; i++) {
            const y = this.margin + (i * this.fretHeight);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', this.margin);
            line.setAttribute('y1', y);
            line.setAttribute('x2', this.margin + this.fretWidth);
            line.setAttribute('y2', y);
            line.setAttribute('class', i === 0 ? 'nut' : 'fret-line');
            svg.appendChild(line);
        }
        
        // Draw strings (vertical lines)
        const stringSpacing = this.fretWidth / (this.strings - 1);
        for (let i = 0; i < this.strings; i++) {
            const x = this.margin + (i * stringSpacing);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', this.margin);
            line.setAttribute('x2', x);
            line.setAttribute('y2', this.margin + (this.frets * this.fretHeight));
            line.setAttribute('class', 'string-line');
            svg.appendChild(line);
        }
        
        // Draw finger positions
        this.chordData.fingers.forEach(([fret, finger], stringIndex) => {
            const x = this.margin + (stringIndex * stringSpacing);
            
            if (fret === -1) {
                // Muted string (X)
                const size = 8;
                const y = this.margin - 10;
                const cross1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                cross1.setAttribute('x1', x - size/2);
                cross1.setAttribute('y1', y - size/2);
                cross1.setAttribute('x2', x + size/2);
                cross1.setAttribute('y2', y + size/2);
                cross1.setAttribute('class', 'muted-string');
                svg.appendChild(cross1);
                
                const cross2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                cross2.setAttribute('x1', x + size/2);
                cross2.setAttribute('y1', y - size/2);
                cross2.setAttribute('x2', x - size/2);
                cross2.setAttribute('y2', y + size/2);
                cross2.setAttribute('class', 'muted-string');
                svg.appendChild(cross2);
            } else if (fret === 0) {
                // Open string (O)
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', this.margin - 10);
                circle.setAttribute('r', 5);
                circle.setAttribute('class', 'open-string');
                svg.appendChild(circle);
            } else {
                // Finger position (filled circle with number)
                const y = this.margin + (fret * this.fretHeight) - (this.fretHeight / 2);
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', 7);
                circle.setAttribute('class', 'finger-dot');
                svg.appendChild(circle);
                
                if (finger > 0) {
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', x);
                    text.setAttribute('y', y);
                    text.setAttribute('class', 'finger-number');
                    text.textContent = finger;
                    svg.appendChild(text);
                }
            }
        });
        
        return svg;
    }
}

function renderGuitarDiagrams(chords) {
    const container = document.getElementById('guitarDiagrams');
    container.innerHTML = '';
    
    // Get unique chords
    const uniqueChords = [...new Set(chords.map(c => c.chord))];
    
    uniqueChords.forEach(chordName => {
        const diagramWrapper = document.createElement('div');
        diagramWrapper.className = 'chord-diagram';
        diagramWrapper.dataset.chord = chordName; // Add data attribute for tracking
        
        const title = document.createElement('div');
        title.className = 'chord-diagram-title';
        title.textContent = chordName;
        
        const diagram = new GuitarChordDiagram(chordName);
        const svg = diagram.render();
        
        diagramWrapper.appendChild(title);
        diagramWrapper.appendChild(svg);
        container.appendChild(diagramWrapper);
    });
}
