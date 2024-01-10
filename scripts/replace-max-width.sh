#!/bin/bash

sed -i 's/(width<=/(max-width:/g' dist/index.html
sed -i 's/(device-width<=/(max-device-width:/g' dist/index.html