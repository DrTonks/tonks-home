# Include inside the tonks.top and blog.tonks.top HTTPS VirtualHosts only.
Alias "/emojis/" "/var/www/shared/emojis/"
<Directory "/var/www/shared/emojis">
    Options -Indexes -ExecCGI
    AllowOverride None
    Require all granted
    Header always set X-Content-Type-Options "nosniff"
    Header set Cache-Control "public, max-age=31536000, immutable"
    <Files "manifest.json">
        Header set Cache-Control "public, max-age=300, must-revalidate"
    </Files>
</Directory>
