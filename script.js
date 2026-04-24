document.getElementById('submitBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('imageInput');
    const promptInput = document.getElementById('promptInput');
    const canvas = document.getElementById('imageCanvas');
    const resultDiv = document.getElementById('result');

    if (!fileInput.files[0]) {
        alert('Please select an image file.');
        return;
    }

    const file = fileInput.files[0];
    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert('Please enter a prompt.');
        return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Image = e.target.result.split(',')[1]; // Remove data:image/...;base64,

        // Display image on canvas
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
        };
        img.src = e.target.result;

        // Prepare request to Ollama API
        const requestBody = {
            model: 'bl_vlm_v1',
            prompt: prompt,
            images: [base64Image],
            stream: false
        };

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const modelResponse = data.response;

            // Display raw response
            resultDiv.textContent = 'Model Response:\n' + modelResponse;

            // Try to parse JSON for parking spaces
            try {
                const parsed = JSON.parse(modelResponse);
                if (parsed.parking_spaces && Array.isArray(parsed.parking_spaces)) {
                    // Draw rectangles on canvas
                    const ctx = canvas.getContext('2d');
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    parsed.parking_spaces.forEach(space => {
                        if (space.length === 4) {
                            const [x1, y1, x2, y2] = space;
                            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                        }
                    });
                }
            } catch (e) {
                console.log('Response is not valid JSON for parking spaces.');
            }
        } catch (error) {
            resultDiv.textContent = 'Error: ' + error.message;
        }
    };
    reader.readAsDataURL(file);
});