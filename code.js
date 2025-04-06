const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');

if (!ctx || !canvas) {
    console.error("Canvas or 2D context not available");
    // Optionally display a message to the user
} else {
    let isMobile = false;
    let particles = [];
    let textImageData = null;
    let animationFrameId;
    let mousePosition = { x: 0, y: 0 }; // Use simple object instead of Ref
    let isTouching = false;             // Use simple boolean

    const NINJA_BLADE_PATH = "M0,-50 L15,-15 C 20,-10 20,10 15,15 L0,50 L-15,15 C -20,10 -20,-10 -15,-15 Z M-35,35 L35,-35 M-35,-35 L35,35"; // Example path for a shuriken-like shape + cross lines
    // You can create more complex SVG paths using an editor like Inkscape or Figma and export the 'd' attribute.

    const updateCanvasSize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        isMobile = window.innerWidth < 768; // Set mobile breakpoint
    };

    function createTextImage() {
        if (!ctx || !canvas) return 0;

        ctx.fillStyle = 'white';
        ctx.save();

        const logoSize = isMobile ? 80 : 150; // Adjust base size of the logo
        const logoHeight = logoSize; // Use size as height for simplicity with square-ish logo
        const logoWidth = logoSize;  // Use size as width

        // Center the logo
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // Draw Ninja Blade Logo
        ctx.save();
        // The scale depends on the native size of your SVG path.
        // Our path goes roughly from -50 to 50 (size 100).
        const bladeScale = logoSize / 100; // Scale based on the path's coordinate system size
        ctx.scale(bladeScale, bladeScale);

        try {
            const path = new Path2D(NINJA_BLADE_PATH);
            ctx.fillStyle = 'white'; // Particles will originate from white areas
            ctx.fill(path);
            // Optional: Add a stroke for definition if needed for getImageData
            // ctx.strokeStyle = 'white';
            // ctx.lineWidth = 2 / bladeScale; // Adjust line width based on scale
            // ctx.stroke(path);
        } catch (error) {
            console.error("Error creating Path2D. Check SVG path syntax:", error);
            // Draw a fallback shape if path fails
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI * 2); // Simple circle
            ctx.fill();
        }

        ctx.restore(); // Restore scale and translation for this logo

        ctx.restore(); // Restore the initial save (before centering)

        // Get image data for particle placement
        try {
            textImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
             console.error("Could not get ImageData (often due to tainted canvas from cross-origin issues, but shouldn't happen here):", e);
             // Handle error, maybe draw fallback particles randomly
             textImageData = null; // Ensure it's null if failed
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the temporary drawing

        return bladeScale; // Return the scale factor used
    }

    function createParticle(scale) {
        if (!ctx || !canvas || !textImageData) return null;

        const data = textImageData.data;
        const width = textImageData.width; // Use ImageData width for indexing
        const height = textImageData.height;

        // Try multiple times to find a valid spot
        for (let attempt = 0; attempt < 50; attempt++) {
            // Pick random coordinates *within the image data dimensions*
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            const index = (y * width + x) * 4;

            // Check the alpha channel of the pixel (data[index + 3])
            if (data[index + 3] > 128) { // Check if the pixel is sufficiently opaque
                 // Found a white pixel from the logo drawing
                 return {
                    x: x,
                    y: y,
                    baseX: x, // Store the original position
                    baseY: y,
                    size: Math.random() * 1.5 + 0.8, // Slightly larger particles
                    color: 'white',
                    scatteredColor: '#00DCFF', // Use a cool blue/cyan for scattering
                    life: Math.random() * 150 + 80 // Longer lifespan
                 };
            }
        }
        return null; // Couldn't find a spot after several attempts
    }

    function createInitialParticles(scale) {
        particles = []; // Clear existing particles
        if (!textImageData) return; // Don't create if image data failed

        const baseParticleCount = 8000; // Adjust for desired density
        // Scale particle count roughly with screen area
        const targetParticleCount = Math.floor(baseParticleCount * Math.sqrt((canvas.width * canvas.height) / (1920 * 1080)));

        let createdCount = 0;
        let attempts = 0;
        const maxAttempts = targetParticleCount * 5; // Limit attempts to prevent infinite loops if logo is tiny

        while (createdCount < targetParticleCount && attempts < maxAttempts) {
            const particle = createParticle(scale);
            if (particle) {
                particles.push(particle);
                createdCount++;
            }
            attempts++;
        }
        console.log(`Created ${createdCount} particles out of target ${targetParticleCount}`);
    }

    function animate(scale) {
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Optional: Draw black background if needed (useful if CSS background fails)
        // ctx.fillStyle = 'black';
        // ctx.fillRect(0, 0, canvas.width, canvas.height);

        const { x: mouseX, y: mouseY } = mousePosition; // Get current mouse/touch position
        const maxDistance = isMobile ? 120 : 180; // Interaction radius
        const pushForce = isMobile ? 40 : 60; // How strongly particles are pushed

        for (let i = particles.length - 1; i >= 0; i--) { // Loop backwards for safe removal
            const p = particles[i];
            const dx = mouseX - p.x;
            const dy = mouseY - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let currentFillStyle = p.color; // Default color

            // Interaction logic
            if (mouseX !== 0 && mouseY !== 0 && distance < maxDistance && (isTouching || !('ontouchstart' in window))) {
                const force = (maxDistance - distance) / maxDistance; // 1 close, 0 far
                const angle = Math.atan2(dy, dx);
                const moveX = Math.cos(angle) * force * pushForce;
                const moveY = Math.sin(angle) * force * pushForce;
                // Apply the push force, moving away from base position
                p.x = p.baseX - moveX;
                p.y = p.baseY - moveY;

                currentFillStyle = p.scatteredColor; // Change color when scattered
            } else {
                // Return to base position
                const returnSpeed = 0.08; // Adjust for how fast particles snap back
                p.x += (p.baseX - p.x) * returnSpeed;
                p.y += (p.baseY - p.y) * returnSpeed;

                currentFillStyle = p.color; // Back to default color
            }

            // Draw the particle
            ctx.fillStyle = currentFillStyle;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); // Center the particle rect

            // Particle lifecycle
            p.life--;
            if (p.life <= 0) {
                // Try to replace the dead particle
                const newParticle = createParticle(scale);
                if (newParticle) {
                    particles[i] = newParticle; // Replace in place
                } else {
                    particles.splice(i, 1); // Remove if no replacement found
                }
            }
        }

        // Replenish particles if needed (e.g., if many died at once)
        const baseParticleCount = 8000;
        const targetParticleCount = Math.floor(baseParticleCount * Math.sqrt((canvas.width * canvas.height) / (1920 * 1080)));
        let replenishAttempts = 0;
        while (particles.length < targetParticleCount && replenishAttempts < 50) { // Limit replenishment attempts per frame
            const newParticle = createParticle(scale);
            if (newParticle) {
                particles.push(newParticle);
            }
            replenishAttempts++;
        }


        animationFrameId = requestAnimationFrame(() => animate(scale));
    }

    // --- Event Handlers ---
    const handleResize = () => {
        console.log("Resizing...");
        updateCanvasSize();
        // Recalculate everything based on new size
        cancelAnimationFrame(animationFrameId); // Stop current animation
        const newScale = createTextImage();
        if (newScale > 0) { // Only proceed if logo generation was successful
             createInitialParticles(newScale);
             if (particles.length > 0) {
                 animate(newScale); // Start animation only if particles were created
             } else {
                  console.warn("No particles created after resize, animation not started.");
             }
        } else {
            console.error("Failed to create text image on resize.");
        }
    };

    const handleMove = (x, y) => {
        mousePosition = { x, y };
    };

    const handleMouseMove = (e) => {
        handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e) => {
        if (e.touches.length > 0) {
            // e.preventDefault(); // Prevent default only if causing issues like scrolling
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    const handleTouchStart = (e) => {
         if (e.touches.length > 0) {
             isTouching = true;
             // Set initial touch position immediately
             handleMove(e.touches[0].clientX, e.touches[0].clientY);
         }
    };

    const handleTouchEnd = () => {
        isTouching = false;
        // Optional: Reset mouse position when touch ends to stop interaction
        // mousePosition = { x: 0, y: 0 };
    };

    const handleMouseLeave = () => {
        // Only reset if not currently touching (for devices with both mouse and touch)
        if (!isTouching) {
             mousePosition = { x: 0, y: 0 }; // Reset position when mouse leaves
        }
    };

    // --- Initialization ---
    updateCanvasSize();
    const initialScale = createTextImage();

    if (initialScale > 0) { // Check if logo generation was successful
        createInitialParticles(initialScale);
         if (particles.length > 0) {
             animate(initialScale); // Start the animation loop
         } else {
             console.warn("No particles generated initially. Check createTextImage and createParticle functions.");
         }
    } else {
        console.error("Failed to create initial text image. Animation not started.");
    }


    // Add Event Listeners
    window.addEventListener('resize', handleResize);
    // Listen on canvas for mouse events, but touch events often work better on window/document
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchmove', handleTouchMove, { passive: true }); // Use passive true if preventDefault isn't needed
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // --- Cleanup (Optional but good practice) ---
    // If this script were part of a larger application lifecycle (like a SPA)
    // you'd want to clean up listeners when the component unmounts.
    // For a simple static page, it's less critical but doesn't hurt.
    // function cleanup() {
    //     window.removeEventListener('resize', handleResize);
    //     canvas.removeEventListener('mousemove', handleMouseMove);
    //     canvas.removeEventListener('mouseleave', handleMouseLeave);
    //     window.removeEventListener('touchmove', handleTouchMove);
    //     window.removeEventListener('touchstart', handleTouchStart);
    //     window.removeEventListener('touchend', handleTouchEnd);
    //     cancelAnimationFrame(animationFrameId);
    //     console.log("Animation stopped and listeners removed.");
    // }
    // Example: window.addEventListener('beforeunload', cleanup);
}