# Include only inside tonks.top and blog.tonks.top HTTPS VirtualHosts.
# The blog build emits this index; both sites read it through the same path.
Alias "/community/articles.json" "/var/www/blog/community/articles.json"
<Directory "/var/www/blog/community">
    Options -Indexes -ExecCGI
    AllowOverride None
    Require all granted
    Header always set X-Content-Type-Options "nosniff"
    Header set Cache-Control "public, max-age=300, must-revalidate"
</Directory>
