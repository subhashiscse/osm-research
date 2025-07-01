import { Component, OnInit } from '@angular/core';
declare let L: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private map: any;
  private drawnItems: any;
  private drawControl: any;

  public currentFillColor: string = '#ff6666';
  public currentStrokeColor: string = '#ff0000';
  public shapesList: any = [];
  public id: any = 1;

  ngOnInit(): void {
    this.id = localStorage.getItem('Id') || 1;
    this.initMap();
  }

  private initMap(): void {
    this.map = L.map('map').setView([23.8103, 90.4125], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.drawnItems = new L.FeatureGroup();
    this.map.addLayer(this.drawnItems);

    const savedData = localStorage.getItem('DrawnShapes');
    if (savedData) {
      const geoJson = JSON.parse(savedData);
      this.shapesList = geoJson.features;

      if (geoJson.features.length > 0) {
        const firstFeatureProps = geoJson.features[0].properties || {};
        if (firstFeatureProps.fillColor) this.currentFillColor = firstFeatureProps.fillColor;
        if (firstFeatureProps.strokeColor) this.currentStrokeColor = firstFeatureProps.strokeColor;
      }

      geoJson.features.forEach((feature: any) => {
        const props = feature.properties || {};
        const shapeType = props.shapeType;
        let layer;

        if (shapeType === 'circle' || feature.geometry.type === 'Point') {
          const coords = feature.geometry.coordinates;
          layer = L.circle([coords[1], coords[0]], {
            radius: props.radius || 100,
            color: props.strokeColor || this.currentStrokeColor,
            fillColor: props.fillColor || this.currentFillColor,
            fillOpacity: 0.5
          });
        } else if (shapeType === "rectangle" || feature.geometry.type === 'Polygon') {
          const coords = feature.geometry.coordinates[0];
          const bounds = L.latLngBounds(coords.map((c: number[]) => [c[1], c[0]]));
          layer = L.rectangle(bounds, {
            color: props.strokeColor || this.currentStrokeColor,
            fillColor: props.fillColor || this.currentFillColor,
            fillOpacity: 0.5
          });
        } else {
          // Handle generic polygon
          layer = L.geoJSON(feature, {
            style: () => ({
              color: props.strokeColor || this.currentStrokeColor,
              fillColor: props.fillColor || this.currentFillColor,
              fillOpacity: 0.5
            })
          }).getLayers()[0];
        }
        if (layer) {
          layer.feature = feature;
          this.drawnItems.addLayer(layer);
        }
      });
    }

    this.addDrawControl();

    this.map.on('draw:created', (event: any) => {
      debugger;
      const layer = event.layer;
      const layerType = event.layerType;
    
      // Style
      if (layer.setStyle) {
        layer.setStyle({
          color: this.currentStrokeColor,
          fillColor: this.currentFillColor,
          fillOpacity: 0.5
        });
        layer.editing?.enable?.();
        layer.dragging?.enable?.();
        layer.options.strokeColor = this.currentStrokeColor;
        layer.options.fillColor = this.currentFillColor;
      }
      const geo = layer.toGeoJSON() as any;
    
      geo.properties = {
        shapeType: layerType,
        strokeColor: this.currentStrokeColor,
        fillColor: this.currentFillColor,
        ...(layerType === 'circle' ? { radius: layer.getRadius() } : {})
      };
      geo.customGeometryType = layerType;
      geo.ShapeId = this.id;
      this.id++;
      layer.feature = geo;
    
      this.drawnItems.addLayer(layer);
    });
    

    this.map.on('draw:deleted', () => {
      this.saveToLocalStorage();
    });
  }

  private addDrawControl(): void {
    if (this.drawControl) {
      this.map.removeControl(this.drawControl);
    }

    const shapeOptions = {
      color: this.currentStrokeColor,
      fillColor: this.currentFillColor,
      fillOpacity: 0.5
    };

    this.drawControl = new L.Control.Draw({
      draw: {
        polygon: { shapeOptions },
        rectangle: { shapeOptions },
        circle: { shapeOptions },
        polyline: { color: this.currentStrokeColor },
        marker: true
      },
      edit: {
        featureGroup: this.drawnItems,
        edit: true,
        remove: true
      }
    });

    this.map.addControl(this.drawControl);
  }

  public updateShapeOptions(): void {
    this.addDrawControl();
  }

  private saveToLocalStorage(): void {
    const geojson = this.drawnItems.toGeoJSON();

    geojson.features.forEach((feature: any) => {
      feature.geometry.type = feature.properties.shapeType;
      const matchingLayer = this.drawnItems.getLayers().find((layer: any) => {
        if (!layer.toGeoJSON) return false;
        const layerGeo = layer.toGeoJSON();
        return JSON.stringify(layerGeo.geometry) === JSON.stringify(feature.geometry);
      });

      if (matchingLayer && matchingLayer.options) {
        feature.properties = feature.properties || {};
        feature.properties.strokeColor = matchingLayer.options.color || this.currentStrokeColor;
        feature.properties.fillColor = matchingLayer.options.fillColor || this.currentFillColor;
        feature.properties.shapeType = matchingLayer.feature?.properties?.shapeType || 'unknown';

        if (feature.properties.shapeType === 'circle') {
          feature.properties.radius = matchingLayer.getRadius?.() || 100;
        }
      }
    });

    localStorage.setItem('DrawnShapes', JSON.stringify(geojson));
    this.shapesList = geojson.features;
  }

  public editShape(index: number): void {
    const targetFeature = this.shapesList[index];
    const props = targetFeature.properties || {};
    const targetShapeType = props.shapeType;
  
    const targetLayer = this.drawnItems.getLayers().find((layer: any) => {
      if (!layer.toGeoJSON) return false;
      const layerGeo = layer.toGeoJSON();
      return layerGeo.ShapeId === targetFeature.ShapeId;
    });
  
    if (!targetLayer) {
      console.warn('Layer not found for editing.');
      return;
    }
  
    // Disable editing and dragging on all layers except the selected one
    this.drawnItems.getLayers().forEach((layer: any) => {
      if (layer !== targetLayer) {
        if (layer.editing?.disable) {
          layer.editing.disable();
        }
        if (layer.dragging?.disable) {
          layer.dragging.disable();
        }
      }
    });
  
    // Enable editing and dragging for the selected layer
    if (targetShapeType === 'circle') {
      targetLayer.editing?.enable?.();
      targetLayer.dragging?.enable?.();
    } else if (targetShapeType === 'marker') {
      targetLayer.dragging?.enable?.();
    } else {
      targetLayer.editing?.enable?.();
      targetLayer.dragging?.enable?.();
    }
  }
  
  saveShape(){
    this.saveToLocalStorage();
  }
  public deleteShape(index: number): void {
    const targetFeature = this.shapesList[index];

    const layerToRemove = this.drawnItems.getLayers().find((layer: any) => {
      if (!layer.toGeoJSON) return false;
      const layerGeo = layer.toGeoJSON();
      return layerGeo.ShapeId === targetFeature.ShapeId;
    });
  
    if (layerToRemove) {
      this.drawnItems.removeLayer(layerToRemove);
    } else {
      console.warn('Layer not found for deletion.');
    }
    this.shapesList.splice(index, 1);
  }
  
}
