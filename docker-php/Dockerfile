# Set up image of PHP
FROM php:8.1-apache

# Set directory where php is installed
WORKDIR /var/www/html

# Copy what is inside this directory in /var/www/html
COPY . /var/www/html

# Install any necessary dependencies
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Expose port 80 to the outside world
EXPOSE 80

# Start Apache in the foreground
CMD ["apache2-foreground"]