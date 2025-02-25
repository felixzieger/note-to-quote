// Proxy script for Plausible Analytics
// This script loads the Plausible analytics script from your custom domain
// but with a different path that's less likely to be blocked by ad blockers

(function () {
    // Create a script element
    var script = document.createElement('script');
    script.defer = true;
    script.setAttribute('data-domain', 'note-to-quote.vercel.app');

    // Set the source to your Plausible instance but with a different filename
    script.src = 'https://plausible.sonnenhof-zieger.de/js/plausible.outbound-links.js';

    // Append the script to the document
    var firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
})(); 