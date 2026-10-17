import { init, use } from 'echarts/core';
import { PieChart, GaugeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

use([PieChart, GaugeChart, TooltipComponent, CanvasRenderer]);

export { init };
